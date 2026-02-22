/**
 * Public App Proxy endpoint: /apps/shopmate/chat
 *
 * Shopify proxies:
 *   https://{store}.myshopify.com/apps/shopmate/chat
 *   → https://shopmate-ai-helper-production.up.railway.app/apps/shopmate/chat
 *
 * Authentication: HMAC signature on the query string, validated by
 * authenticate.public.appProxy.  No session cookie required — works for
 * any storefront visitor.
 *
 * Called by chat-widget.js running in the Theme App Extension.
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "~/shopify.server";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "~/db.server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Freemium constants ────────────────────────────────────────────────────────

const FREE_LIMIT = 50; // messages per month on free plan

// ─── Intent helpers ───────────────────────────────────────────────────────────

function extractOrderNumber(text: string): string | null {
  const match = text.match(/#?\b(\d{3,6})\b/);
  return match ? `#${match[1]}` : null;
}

function isOrderTrackingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  // Direct order number reference (e.g. #5050) always triggers tracking
  if (/#\d{3,}/.test(text)) return true;
  // "track my order", "where is my order", "order status", etc.
  return (
    /\border\b/.test(lower) &&
    /track|status|where|shipped|delivery|arrive|package|shipment|dispatch/.test(lower)
  );
}

function isProductRecommendationIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return /recommend|suggest|show me|looking for|find me|what.*product|product.*recommend|popular|best seller|what do you (sell|have|carry|offer)|do you (have|sell|carry|offer)|your products|browse|catalog|collection/.test(lower);
}

function extractProductQuery(text: string): string {
  const stripped = text
    .toLowerCase()
    .replace(
      /recommend|suggest|show me|looking for|find me|what.*products?|best seller[s]?|popular|what do you (sell|have|carry|offer)|do you (have|sell|carry|offer)|your products|browse|catalog|collection/g,
      "",
    )
    .replace(/\?|please|can you|could you|i.*want|i.*need/g, "")
    .trim();
  // If we stripped everything meaningful, fetch popular products as a general catalog response
  return stripped || "status:active";
}

// ─── Escalation detection (used only for counter logic) ───────────────────────

const ESCALATION_PATTERN = /\b(escalate|human agent|speak to (a |someone|an) (human|person|agent|representative)|talk to (a |someone|an) (human|person|agent|representative)|live (chat|support|agent)|real person|customer service rep)\b/i;

function replyIsEscalation(reply: string): boolean {
  return ESCALATION_PATTERN.test(reply);
}

// ─── GraphQL queries ──────────────────────────────────────────────────────────

const ORDER_QUERY = `#graphql
  query GetOrder($query: String!) {
    orders(first: 1, query: $query) {
      nodes {
        name
        displayFinancialStatus
        displayFulfillmentStatus
        createdAt
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        shippingAddress { city province country }
        fulfillments(first: 1) {
          trackingInfo(first: 1) { number url company }
          displayStatus
          estimatedDeliveryAt
        }
        lineItems(first: 5) { nodes { title quantity } }
      }
    }
  }
`;

const PRODUCTS_QUERY = `#graphql
  query GetProducts($query: String!) {
    products(first: 5, query: $query, sortKey: BEST_SELLING) {
      nodes {
        id title handle
        featuredImage { url }
        priceRangeV2 { minVariantPrice { amount currencyCode } }
      }
    }
  }
`;

interface ProductResult {
  id: string;
  handle: string;
  title: string;
  price: string;
  image: string | null;
  url: string;
}

async function fetchOrderContext(admin: AdminApiContext, orderNumber: string): Promise<string> {
  try {
    const res = await admin.graphql(ORDER_QUERY, {
      variables: { query: `name:${orderNumber}` },
    });
    const json = (await res.json()) as {
      data?: {
        orders?: {
          nodes?: Array<{
            name?: string;
            displayFinancialStatus?: string;
            displayFulfillmentStatus?: string;
            createdAt?: string;
            currentTotalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } };
            shippingAddress?: { city?: string; province?: string; country?: string };
            fulfillments?: Array<{
              trackingInfo?: Array<{ number?: string; url?: string; company?: string }>;
              displayStatus?: string;
              estimatedDeliveryAt?: string | null;
            }>;
            lineItems?: { nodes?: Array<{ title?: string; quantity?: number }> };
          }>;
        };
      };
    };

    const order = json?.data?.orders?.nodes?.[0];
    if (!order) return `No order found with number ${orderNumber}. Please verify and try again.`;

    const fulfillment = order.fulfillments?.[0];
    const tracking = fulfillment?.trackingInfo?.[0];
    const items = order.lineItems?.nodes?.map((li) => `${li.quantity}x ${li.title}`).join(", ");
    const addr = order.shippingAddress;
    const price = order.currentTotalPriceSet?.shopMoney;

    let ctx = `ORDER FOUND — ${order.name}:
- Status: ${order.displayFulfillmentStatus || "unfulfilled"} / ${order.displayFinancialStatus || "unknown"}
- Date: ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "unknown"}
- Total: ${price ? `${price.amount} ${price.currencyCode}` : "unknown"}
- Items: ${items || "unknown"}`;
    if (addr)
      ctx += `\n- Ships to: ${[addr.city, addr.province, addr.country].filter(Boolean).join(", ")}`;
    if (fulfillment?.displayStatus) ctx += `\n- Fulfillment: ${fulfillment.displayStatus}`;
    if (fulfillment?.estimatedDeliveryAt)
      ctx += `\n- Est. delivery: ${new Date(fulfillment.estimatedDeliveryAt).toLocaleDateString()}`;
    if (tracking)
      ctx += `\n- Tracking: ${tracking.number ?? "N/A"} via ${tracking.company ?? "carrier"}${tracking.url ? ` (${tracking.url})` : ""}`;
    return ctx;
  } catch {
    return "Unable to retrieve order information right now. Please try again.";
  }
}

async function fetchProducts(
  admin: AdminApiContext,
  query: string,
  shop: string,
): Promise<{ context: string; products: ProductResult[] }> {
  try {
    const res = await admin.graphql(PRODUCTS_QUERY, { variables: { query } });
    const json = (await res.json()) as {
      data?: {
        products?: {
          nodes?: Array<{
            id?: string;
            title?: string;
            handle?: string;
            featuredImage?: { url?: string } | null;
            priceRangeV2?: { minVariantPrice?: { amount?: string; currencyCode?: string } };
          }>;
        };
      };
    };

    const nodes = json?.data?.products?.nodes ?? [];
    if (!nodes.length) return { context: "No matching products found.", products: [] };

    const products: ProductResult[] = nodes.map((p) => {
      const price = p.priceRangeV2?.minVariantPrice;
      const amount = price?.amount ? parseFloat(price.amount).toFixed(2) : "0.00";
      return {
        id: p.id ?? "",
        handle: p.handle ?? "",
        title: p.title ?? "Product",
        price: `${price?.currencyCode ?? "USD"} ${amount}`,
        image: p.featuredImage?.url ?? null,
        url: `https://${shop}/products/${p.handle ?? ""}`,
      };
    });

    return {
      context: `RECOMMENDED PRODUCTS:\n${products.map((p) => `- ${p.title} at ${p.price}`).join("\n")}`,
      products,
    };
  } catch {
    return { context: "Unable to fetch product recommendations right now.", products: [] };
  }
}

// ─── CORS headers ─────────────────────────────────────────────────────────────

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // ── Diagnostic logging ────────────────────────────────────────────────────
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const hasHmacParams = "hmac" in params || "signature" in params;

  console.log("[appProxy] ── Incoming ──────────────────────────────────────");
  console.log("[appProxy] method         :", request.method);
  console.log("[appProxy] pathname       :", url.pathname);
  console.log("[appProxy] search         :", url.search || "(empty — no HMAC params!)");
  console.log("[appProxy] hasHmacParams  :", hasHmacParams);
  console.log("[appProxy] x-shopify-shop :", request.headers.get("x-shopify-shop-domain") ?? "(missing)");
  console.log("[appProxy] SHOPIFY_API_SECRET present:", !!process.env.SHOPIFY_API_SECRET);
  console.log("[appProxy] SHOPIFY_API_SECRET length :", process.env.SHOPIFY_API_SECRET?.length ?? 0);
  console.log("[appProxy] ────────────────────────────────────────────────────");

  // ── Auth ──────────────────────────────────────────────────────────────────
  let shop: string;
  let adminCtx: AdminApiContext | undefined;

  try {
    const ctx = await authenticate.public.appProxy(request);
    shop = ctx.session?.shop ?? "";
    adminCtx = ctx.admin ?? undefined;
    console.log("[appProxy] ✓ Auth success — shop:", shop, "| hasAdmin:", !!adminCtx);
  } catch (err) {
    const errMsg   = err instanceof Error ? err.message   : String(err);
    const errCause = err instanceof Error && err.cause
      ? (err.cause instanceof Error ? err.cause.message : String(err.cause))
      : "(no cause)";
    console.error("[appProxy] ✗ Auth FAILED", errMsg, errCause);
    return Response.json(
      { error: "Unauthorized", debug: errMsg, cause: errCause },
      { status: 401, headers: CORS },
    );
  }

  if (!shop) {
    return Response.json({ error: "Could not determine shop" }, { status: 400, headers: CORS });
  }

  // ── Fallback: get admin context from stored offline token if proxy didn't provide one ──
  // authenticate.public.appProxy returns adminCtx only when an offline session exists in DB.
  // unauthenticated.admin uses the stored offline access token directly, which is always
  // available after the merchant installs the app.
  if (!adminCtx) {
    try {
      const fallback = await unauthenticated.admin(shop);
      adminCtx = fallback.admin;
      console.log("[appProxy] ✓ Fallback admin context obtained for shop:", shop);
    } catch (fallbackErr) {
      console.warn("[appProxy] Could not get fallback admin context:", fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr));
      // adminCtx stays undefined — order/product lookups will be skipped
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { message?: string; conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
  }

  const { message, conversationId } = body;
  if (!message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400, headers: CORS });
  }

  // ── Load / upsert ShopSettings ────────────────────────────────────────────
  const now = new Date();
  let settings = await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });

  // Monthly reset: if lastReset is in a different year/month, reset counter
  const resetDate = new Date(settings.lastReset);
  if (
    now.getUTCFullYear() !== resetDate.getUTCFullYear() ||
    now.getUTCMonth() !== resetDate.getUTCMonth()
  ) {
    settings = await prisma.shopSettings.update({
      where: { shop },
      data: { messageCount: 0, lastReset: now },
    });
    console.log("[appProxy] Monthly reset applied for shop:", shop);
  }

  // ── Freemium gate ─────────────────────────────────────────────────────────
  const isPro = settings.plan === "pro";
  console.log("[appProxy] plan:", settings.plan, "| messageCount:", settings.messageCount, "| isPro:", isPro);

  if (!isPro && settings.messageCount >= FREE_LIMIT) {
    console.log("[appProxy] Limit reached for shop:", shop);
    return Response.json(
      {
        error: "limit_reached",
        remaining: 0,
        limit: FREE_LIMIT,
        upgradeUrl: `https://${shop}/admin/apps/shopmate-ai`,
      },
      { status: 402, headers: CORS },
    );
  }

  // ── Increment message count (1 per user turn) ─────────────────────────────
  if (!isPro) {
    await prisma.shopSettings.update({
      where: { shop },
      data: { messageCount: { increment: 1 } },
    });
  }

  // ── Find or create conversation ───────────────────────────────────────────
  const existingConv = conversationId
    ? await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
    : null;

  const conv =
    existingConv ??
    (await prisma.conversation.create({
      data: { shop, sessionId: `proxy-${Date.now()}` },
      include: { messages: true },
    }));

  await prisma.message.create({
    data: { conversationId: conv.id, role: "user", content: message },
  });

  // ── Intent detection + Shopify data ───────────────────────────────────────
  let extraContext = "";
  let products: ProductResult[] = [];

  if (adminCtx) {
    if (isOrderTrackingIntent(message)) {
      const orderNumber = extractOrderNumber(message);
      extraContext = orderNumber
        ? await fetchOrderContext(adminCtx, orderNumber)
        : "The customer asked about order tracking but did not provide an order number. Ask them for it (e.g. #1234).";
    } else if (isProductRecommendationIntent(message)) {
      const result = await fetchProducts(adminCtx, extractProductQuery(message), shop);
      extraContext = result.context;
      products = result.products;
    }
  }

  // ── Build message history ─────────────────────────────────────────────────
  const history = conv.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // ── Fetch active Knowledge Base entries for this shop ─────────────────────
  // Only load active entries; draft entries are explicitly excluded.
  const kbEntries = await prisma.knowledgeBase.findMany({
    where: { shop, status: "active" },
    select: { title: true, content: true },
    orderBy: { updatedAt: "desc" },
    take: 20, // cap to avoid token bloat on very large KBs
  });

  const kbContext = kbEntries.length > 0
    ? "\nSTORE KNOWLEDGE BASE:\n" +
      kbEntries.map((e) => `### ${e.title}\n${e.content}`).join("\n\n")
    : "";

  // ── System prompt ─────────────────────────────────────────────────────────
  const systemPrompt = [
    `You are ShopMate, a helpful AI assistant for the Shopify store ${shop}. Help customers with order tracking, product recommendations, returns, and general questions. Be friendly, concise, and helpful.`,
    kbContext,
    extraContext ? `\nLIVE ORDER/PRODUCT CONTEXT:\n${extraContext}` : "",
    products.length > 0 ? "\nPresent product cards after your reply. Briefly introduce them." : "",
  ]
    .filter(Boolean)
    .join("\n");

  // ── Call Anthropic ────────────────────────────────────────────────────────
  const aiRes = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [...history, { role: "user", content: message }],
  });

  const reply =
    aiRes.content[0].type === "text" ? aiRes.content[0].text : "Sorry, I could not process that.";

  await prisma.message.create({
    data: { conversationId: conv.id, role: "assistant", content: reply },
  });

  // ── Update review counters (merchant dashboard reads these for trigger logic) ─
  // These counters feed the review banner in the admin dashboard — never the widget.
  const isEscalation = replyIsEscalation(reply);
  const wasOrderTracking = isOrderTrackingIntent(message) && extraContext.startsWith("ORDER FOUND");

  const counterUpdate: Record<string, unknown> = {};
  if (!isEscalation) {
    counterUpdate.aiHandledChats = { increment: 1 };
  }
  if (wasOrderTracking) {
    counterUpdate.orderTrackingResolved = { increment: 1 };
  }
  if (Object.keys(counterUpdate).length > 0) {
    await prisma.shopSettings.update({ where: { shop }, data: counterUpdate });
  }

  // ── Response ──────────────────────────────────────────────────────────────
  const remaining = isPro ? null : Math.max(0, FREE_LIMIT - (settings.messageCount + 1));

  return Response.json(
    {
      reply,
      conversationId: conv.id,
      products: products.length > 0 ? products : undefined,
      remaining, // null = pro (unlimited), number = messages left this month
    },
    { headers: CORS },
  );
};
