/**
 * App Proxy base route: /apps/shopmate
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Shopify's proxy forwarding rule is:
 *   storefront path: myshopify.com/{prefix}/{subpath}/{rest}
 *   forwarded to:    {url}/{rest}
 *
 * With subpath="shopmate" and url="...railway.app/apps/shopmate":
 *   /apps/shopmate/chat  →  railway.app/apps/shopmate/chat  (apps.shopmate.chat.tsx)
 *   /apps/shopmate       →  railway.app/apps/shopmate        (THIS file)
 *
 * This handler runs the full chat pipeline (same logic as apps.shopmate.chat.tsx)
 * so the widget works regardless of which forwarded path Shopify is currently using.
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "~/shopify.server";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "~/db.server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Intent helpers ───────────────────────────────────────────────────────────

function extractOrderNumber(text: string): string | null {
  const match = text.match(/#?\b(\d{3,7})\b/);
  return match ? match[1] : null; // returns bare digits
}

function isOrderTrackingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  if (/#\d{3,}/.test(text)) return true;
  if (/\b\d{3,7}\b/.test(text) && /track|order|status|where|shipped/.test(lower)) return true;
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
  return stripped || "status:active";
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
  title: string;
  handle: string;
  price: string;
  image: string | null;
  url: string;
}

async function fetchOrderContext(admin: AdminApiContext, rawNumber: string): Promise<string> {
  const digits = rawNumber.replace(/^#/, "");
  const withHash = `#${digits}`;
  const queriesToTry = [`name:${withHash}`, `name:${digits}`];
  console.log(`[base/order] Looking up order ${withHash}, queries:`, queriesToTry);
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
      if (json.errors?.length) {
        const errMsg = json.errors.map((e) => e.message).join("; ");
        console.error(`[base/order] GraphQL errors for "${q}":`, errMsg);
        lastError = `GraphQL error: ${errMsg}`;
        continue;
      }
      const order = json?.data?.orders?.nodes?.[0];
      if (!order) { console.log(`[base/order] No result for "${q}"`); continue; }

      const fulfillment = order.fulfillments?.[0];
      const tracking = fulfillment?.trackingInfo?.[0];
      const items = order.lineItems?.nodes?.map((li) => `${li.quantity}x ${li.title}`).join(", ");
      const addr = order.shippingAddress;
      const price = order.currentTotalPriceSet?.shopMoney;

      let ctx = `ORDER FOUND — ${order.name}:\n- Payment: ${order.displayFinancialStatus || "unknown"}\n- Fulfillment: ${order.displayFulfillmentStatus || "unfulfilled"}\n- Date: ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "unknown"}\n- Total: ${price ? `${price.amount} ${price.currencyCode}` : "unknown"}\n- Items: ${items || "unknown"}`;
      if (addr) ctx += `\n- Ships to: ${[addr.city, addr.province, addr.country].filter(Boolean).join(", ")}`;
      if (fulfillment?.displayStatus) ctx += `\n- Status: ${fulfillment.displayStatus}`;
      if (fulfillment?.estimatedDeliveryAt) ctx += `\n- Est. delivery: ${new Date(fulfillment.estimatedDeliveryAt).toLocaleDateString()}`;
      if (tracking) {
        ctx += `\n- Tracking #: ${tracking.number ?? "N/A"} via ${tracking.company ?? "carrier"}`;
        if (tracking.url) ctx += ` — Track here: ${tracking.url}`;
      }
      if (order.statusPageUrl) ctx += `\n- Order status page: ${order.statusPageUrl}`;
      return ctx;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[base/order] Exception for "${q}":`, msg);
      lastError = msg;
    }
  }
  return lastError
    ? `ORDER_LOOKUP_ERROR: ${lastError}. Could not retrieve order ${withHash}.`
    : `ORDER_NOT_FOUND:${withHash}`;
}

async function fetchProducts(
  admin: AdminApiContext,
  query: string,
  shop: string,
): Promise<{ context: string; products: ProductResult[]; error?: string }> {
  console.log(`[base/products] query: "${query}" for shop "${shop}"`);
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
    if (json.errors?.length) {
      const errMsg = json.errors.map((e) => e.message).join("; ");
      console.error("[base/products] GraphQL errors:", errMsg);
      const isScopeError = /access denied|read_products|unauthorized|forbidden/i.test(errMsg);
      const reason = isScopeError ? "missing scope read_products — app needs reinstall" : errMsg;
      return { context: `PRODUCT_ACCESS_ERROR: ${reason}`, products: [], error: reason };
    }
    const nodes = json?.data?.products?.nodes ?? [];
    console.log(`[base/products] ${nodes.length} product(s) returned`);
    if (!nodes.length) {
      return { context: `PRODUCT_EMPTY: 0 products for query "${query}"`, products: [], error: `0 products returned` };
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
    return { context: `RECOMMENDED PRODUCTS:\n${products.map((p) => `- ${p.title} at ${p.price}`).join("\n")}`, products };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[base/products] Exception:", msg);
    return { context: `PRODUCT_EXCEPTION: ${msg}`, products: [], error: msg };
  }
}

// ─── CORS headers ─────────────────────────────────────────────────────────────

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const hasHmacParams = "hmac" in params || "signature" in params;

  console.log("[appProxy/base] ── Incoming ─────────────────────────────────────");
  console.log("[appProxy/base] NOTE: hit /apps/shopmate (no /chat suffix)");
  console.log("[appProxy/base] method         :", request.method);
  console.log("[appProxy/base] pathname       :", url.pathname);
  console.log("[appProxy/base] search         :", url.search || "(empty — no HMAC params!)");
  console.log("[appProxy/base] hasHmacParams  :", hasHmacParams);
  console.log("[appProxy/base] x-shopify-shop :", request.headers.get("x-shopify-shop-domain") ?? "(missing)");
  console.log("[appProxy/base] SHOPIFY_API_SECRET present:", !!process.env.SHOPIFY_API_SECRET);
  console.log("[appProxy/base] ─────────────────────────────────────────────────");

  let shop: string;
  let adminCtx: AdminApiContext | undefined;

  try {
    const ctx = await authenticate.public.appProxy(request);
    shop = ctx.session?.shop ?? "";
    adminCtx = ctx.admin ?? undefined;
    console.log("[appProxy/base] ✓ Auth success — shop:", shop, "| hasAdmin:", !!adminCtx);
  } catch (err) {
    const errMsg   = err instanceof Error ? err.message : String(err);
    const errCause = err instanceof Error && err.cause
      ? (err.cause instanceof Error ? err.cause.message : String(err.cause))
      : "(no cause)";
    console.error("[appProxy/base] ✗ Auth FAILED:", errMsg, errCause);
    return Response.json({ error: "Unauthorized", debug: errMsg, cause: errCause }, { status: 401, headers: CORS });
  }

  if (!shop) {
    return Response.json({ error: "Could not determine shop" }, { status: 400, headers: CORS });
  }

  if (!adminCtx) {
    try {
      const fallback = await unauthenticated.admin(shop);
      adminCtx = fallback.admin;
      console.log("[appProxy/base] ✓ Fallback admin context obtained for shop:", shop);
    } catch (fallbackErr) {
      const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      console.warn("[appProxy/base] ✗ Could not get fallback admin context:", msg);
      console.warn("[appProxy/base]   → No offline session in DB for shop:", shop);
    }
  }

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

  let extraContext = "";
  let products: ProductResult[] = [];

  if (!adminCtx) {
    console.warn("[appProxy/base] adminCtx missing — order/product features disabled for shop:", shop);
    // Set sentinels so the AI gives a useful reply for intent-matching messages
    if (isOrderTrackingIntent(message)) {
      extraContext = "NO_ADMIN_CTX_ORDER: Order tracking is temporarily unavailable.";
    } else if (isProductRecommendationIntent(message)) {
      extraContext = "NO_ADMIN_CTX_PRODUCT: Product catalog is temporarily unavailable.";
    }
  } else if (isOrderTrackingIntent(message)) {
    const rawNumber = extractOrderNumber(message);
    if (rawNumber) {
      extraContext = await fetchOrderContext(adminCtx, rawNumber);
    } else {
      extraContext = "NEED_ORDER_NUMBER: Customer asked about tracking but gave no order number.";
    }
  } else if (isProductRecommendationIntent(message)) {
    const result = await fetchProducts(adminCtx, extractProductQuery(message), shop);
    extraContext = result.context;
    products = result.products;
  }

  const history = conv.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Map diagnostic sentinel strings to AI-friendly instructions (most-specific first)
  let extraContextForAI = extraContext;
  if (extraContext.startsWith("ORDER_NOT_FOUND:")) {
    const num = extraContext.replace("ORDER_NOT_FOUND:", "");
    extraContextForAI = `No order found matching ${num}. Ask the customer to double-check their order number from their confirmation email.`;
  } else if (extraContext.startsWith("ORDER_LOOKUP_ERROR:")) {
    extraContextForAI = "Order lookup failed. Apologise and suggest the customer contact support.";
  } else if (extraContext.startsWith("NEED_ORDER_NUMBER:")) {
    extraContextForAI = "Ask the customer for their order number (e.g. #1234) from their confirmation email.";
  } else if (extraContext.startsWith("NO_ADMIN_CTX_ORDER:")) {
    extraContextForAI = "Order tracking is temporarily unavailable due to a configuration issue. Apologise and ask the customer to check their confirmation email for a tracking link or contact the store directly.";
  } else if (extraContext.startsWith("NO_ADMIN_CTX_PRODUCT:")) {
    extraContextForAI = `The live product catalog is temporarily unavailable. Apologise briefly and direct the customer to browse products directly at https://${shop}/collections/all.`;
  } else if (extraContext.startsWith("PRODUCT_ACCESS_ERROR:")) {
    extraContextForAI = `Product catalog access failed. Apologise briefly and direct the customer to https://${shop}/collections/all to browse directly.`;
  } else if (extraContext.startsWith("PRODUCT_EMPTY:")) {
    extraContextForAI = `No products matched that query. Suggest the customer browse https://${shop}/collections/all or try a different search term.`;
  } else if (extraContext.startsWith("PRODUCT_EXCEPTION:")) {
    extraContextForAI = `Product information is temporarily unavailable. Apologise and direct the customer to https://${shop}/collections/all.`;
  }

  const systemPrompt = [
    `You are ShopMate, a helpful AI assistant for the Shopify store ${shop}. Help customers with order tracking, product recommendations, returns, and general questions. Be friendly, concise, and helpful.`,
    extraContextForAI ? `\nCONTEXT:\n${extraContextForAI}` : "",
    products.length > 0 ? "\nPresent product cards after your reply. Briefly introduce them." : "",
  ]
    .filter(Boolean)
    .join("\n");

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

  return Response.json(
    { reply, conversationId: conv.id, products: products.length > 0 ? products : undefined },
    { headers: CORS },
  );
};
