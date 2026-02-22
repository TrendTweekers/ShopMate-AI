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
  const match = text.match(/#?\b(\d{3,7})\b/);
  return match ? match[1] : null; // returns bare digits, e.g. "5050"
}

function isOrderTrackingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  // Bare order number reference (e.g. #5050 or "order 5050") always triggers tracking
  if (/#\d{3,}/.test(text)) return true;
  // Digit-only that looks like an order number when combined with tracking words
  if (/\b\d{3,7}\b/.test(text) && /track|order|status|where|shipped/.test(lower)) return true;
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
  // If we stripped everything meaningful, fetch all active products as a general catalog response
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
        statusPageUrl
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

// ─── fetchOrderContext ────────────────────────────────────────────────────────
// Tries name:#NNNN and name:NNNN to handle both normalised forms.
// Returns a structured context string for the AI, or a precise error.

async function fetchOrderContext(admin: AdminApiContext, rawNumber: string): Promise<string> {
  // Normalise: strip any leading # to get bare digits
  const digits = rawNumber.replace(/^#/, "");
  const withHash = `#${digits}`;

  // Try both forms — some shops store orders as "#5050", others as "5050"
  const queriesToTry = [`name:${withHash}`, `name:${digits}`];
  console.log(`[order] Looking up order ${withHash}, trying queries:`, queriesToTry);

  let lastError: string | null = null;

  for (const q of queriesToTry) {
    try {
      const res = await admin.graphql(ORDER_QUERY, { variables: { query: q } });
      const json = (await res.json()) as {
        errors?: Array<{ message: string }>;
        data?: {
          orders?: {
            nodes?: Array<{
              name?: string;
              displayFinancialStatus?: string;
              displayFulfillmentStatus?: string;
              createdAt?: string;
              statusPageUrl?: string;
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

      // Check for GraphQL-level errors (e.g. missing read_orders scope)
      if (json.errors?.length) {
        const errMsg = json.errors.map((e) => e.message).join("; ");
        console.error(`[order] GraphQL errors for query "${q}":`, errMsg);
        lastError = `GraphQL error: ${errMsg}`;
        continue;
      }

      const order = json?.data?.orders?.nodes?.[0];
      if (!order) {
        console.log(`[order] No order found for query "${q}"`);
        continue; // try next form
      }

      console.log(`[order] Found order ${order.name} via query "${q}"`);

      const fulfillment = order.fulfillments?.[0];
      const tracking = fulfillment?.trackingInfo?.[0];
      const items = order.lineItems?.nodes?.map((li) => `${li.quantity}x ${li.title}`).join(", ");
      const addr = order.shippingAddress;
      const price = order.currentTotalPriceSet?.shopMoney;

      let ctx = `ORDER FOUND — ${order.name}:
- Payment: ${order.displayFinancialStatus || "unknown"}
- Fulfillment: ${order.displayFulfillmentStatus || "unfulfilled"}
- Date: ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "unknown"}
- Total: ${price ? `${price.amount} ${price.currencyCode}` : "unknown"}
- Items: ${items || "unknown"}`;

      if (addr) ctx += `\n- Ships to: ${[addr.city, addr.province, addr.country].filter(Boolean).join(", ")}`;
      if (fulfillment?.displayStatus) ctx += `\n- Status: ${fulfillment.displayStatus}`;
      if (fulfillment?.estimatedDeliveryAt)
        ctx += `\n- Est. delivery: ${new Date(fulfillment.estimatedDeliveryAt).toLocaleDateString()}`;
      if (tracking) {
        ctx += `\n- Tracking #: ${tracking.number ?? "N/A"} via ${tracking.company ?? "carrier"}`;
        if (tracking.url) ctx += ` — Track here: ${tracking.url}`;
      }
      if (order.statusPageUrl) ctx += `\n- Order status page: ${order.statusPageUrl}`;

      return ctx;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[order] Exception for query "${q}":`, msg);
      lastError = msg;
    }
  }

  // All queries failed/no match
  if (lastError) {
    return `ORDER_LOOKUP_ERROR: ${lastError}. Could not retrieve order ${withHash}.`;
  }
  return `ORDER_NOT_FOUND:${withHash}`;
}

// ─── fetchProducts ────────────────────────────────────────────────────────────
// Returns products + a diagnostic error string if the call fails.

async function fetchProducts(
  admin: AdminApiContext,
  query: string,
  shop: string,
): Promise<{ context: string; products: ProductResult[]; error?: string }> {
  console.log(`[products] Fetching products for shop "${shop}" with query: "${query}"`);
  try {
    const res = await admin.graphql(PRODUCTS_QUERY, { variables: { query } });
    const json = (await res.json()) as {
      errors?: Array<{ message: string }>;
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

    // GraphQL-level errors (e.g. missing read_products scope)
    if (json.errors?.length) {
      const errMsg = json.errors.map((e) => e.message).join("; ");
      console.error("[products] GraphQL errors:", errMsg);
      const isScopeError = /access denied|read_products|unauthorized|forbidden/i.test(errMsg);
      const reason = isScopeError
        ? "missing scope read_products — app needs reinstall"
        : errMsg;
      return {
        context: `PRODUCT_ACCESS_ERROR: ${reason}`,
        products: [],
        error: reason,
      };
    }

    const nodes = json?.data?.products?.nodes ?? [];
    console.log(`[products] Returned ${nodes.length} product(s) for query "${query}"`);

    if (!nodes.length) {
      return {
        context: `PRODUCT_EMPTY: 0 products returned for query "${query}". Store may have no active products or the query returned no matches.`,
        products: [],
        error: `0 products returned for query "${query}"`,
      };
    }

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[products] Exception fetching products:", msg);
    return {
      context: `PRODUCT_EXCEPTION: ${msg}`,
      products: [],
      error: msg,
    };
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

  // ── Fallback: get admin context from stored offline token ─────────────────
  // authenticate.public.appProxy returns adminCtx only when an offline session exists in DB.
  // unauthenticated.admin uses the stored offline access token directly.
  if (!adminCtx) {
    try {
      const fallback = await unauthenticated.admin(shop);
      adminCtx = fallback.admin;
      console.log("[appProxy] ✓ Fallback admin context obtained for shop:", shop);
    } catch (fallbackErr) {
      const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      console.warn("[appProxy] ✗ Could not get fallback admin context:", msg);
      console.warn("[appProxy]   → Product/order features will be disabled for this request.");
      console.warn("[appProxy]   → Cause: No offline session in DB for shop:", shop);
      console.warn("[appProxy]   → Fix: Merchant must reinstall/re-auth the app.");
      // adminCtx stays undefined — we continue but features are disabled
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
  let featureError: string | undefined;

  if (!adminCtx) {
    // Log clearly instead of silently skipping
    console.warn("[appProxy] adminCtx is missing — order/product features disabled.");
    console.warn("[appProxy] Reason: no offline session token for shop:", shop);
    featureError = "no_admin_ctx";
  } else if (isOrderTrackingIntent(message)) {
    const rawNumber = extractOrderNumber(message);
    if (rawNumber) {
      console.log("[appProxy] Order tracking intent — order number:", rawNumber);
      extraContext = await fetchOrderContext(adminCtx, rawNumber);

      // Log the lookup outcome clearly
      if (extraContext.startsWith("ORDER_NOT_FOUND:")) {
        console.warn("[appProxy] Order not found:", extraContext);
      } else if (extraContext.startsWith("ORDER_LOOKUP_ERROR:")) {
        console.error("[appProxy] Order lookup error:", extraContext);
      } else {
        console.log("[appProxy] Order context retrieved successfully");
      }
    } else {
      extraContext = "NEED_ORDER_NUMBER: Customer asked about order tracking but did not provide an order number. Ask them for their order number (e.g. #1234).";
      console.log("[appProxy] Order tracking intent — no order number found in message");
    }
  } else if (isProductRecommendationIntent(message)) {
    const productQuery = extractProductQuery(message);
    console.log("[appProxy] Product recommendation intent — query:", productQuery);
    const result = await fetchProducts(adminCtx, productQuery, shop);
    extraContext = result.context;
    products = result.products;
    featureError = result.error;

    if (result.error) {
      console.error("[appProxy] Product fetch error:", result.error);
    }
  }

  // ── Build message history ─────────────────────────────────────────────────
  const history = conv.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // ── Fetch active Knowledge Base entries for this shop ─────────────────────
  const kbEntries = await prisma.knowledgeBase.findMany({
    where: { shop, status: "active" },
    select: { title: true, content: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const kbContext = kbEntries.length > 0
    ? "\nSTORE KNOWLEDGE BASE:\n" +
      kbEntries.map((e) => `### ${e.title}\n${e.content}`).join("\n\n")
    : "";

  // ── System prompt ─────────────────────────────────────────────────────────
  // Special handling for diagnostic contexts so the AI gives precise answers
  let extraContextForAI = "";
  if (extraContext.startsWith("ORDER_NOT_FOUND:")) {
    const num = extraContext.replace("ORDER_NOT_FOUND:", "");
    extraContextForAI = `No order found matching ${num}. Possible reasons: the order number may be wrong, the order belongs to a different store, or it was placed very recently and hasn't synced. Ask the customer to double-check their confirmation email and provide the exact order number.`;
  } else if (extraContext.startsWith("ORDER_LOOKUP_ERROR:")) {
    extraContextForAI = `Order lookup failed with a technical error. Apologise and ask the customer to try again or contact support.`;
  } else if (extraContext.startsWith("ORDER_LOOKUP_ERROR:") || extraContext.startsWith("PRODUCT_ACCESS_ERROR:") || extraContext.startsWith("PRODUCT_EMPTY:") || extraContext.startsWith("PRODUCT_EXCEPTION:")) {
    extraContextForAI = `Product information is temporarily unavailable. Apologise and suggest the customer browse the store directly.`;
  } else if (extraContext.startsWith("NEED_ORDER_NUMBER:")) {
    extraContextForAI = "The customer asked about an order but did not provide an order number. Ask them for their order number from their confirmation email (e.g. #1234).";
  } else {
    extraContextForAI = extraContext;
  }

  const systemPrompt = [
    `You are ShopMate, a helpful AI assistant for the Shopify store ${shop}. Help customers with order tracking, product recommendations, returns, and general questions. Be friendly, concise, and helpful.`,
    kbContext,
    extraContextForAI ? `\nLIVE ORDER/PRODUCT CONTEXT:\n${extraContextForAI}` : "",
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

  // ── Update review counters ────────────────────────────────────────────────
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
      remaining,
      // Dev-friendly diagnostic fields (won't affect widget UX)
      _debug: featureError ? { featureError } : undefined,
    },
    { headers: CORS },
  );
};
