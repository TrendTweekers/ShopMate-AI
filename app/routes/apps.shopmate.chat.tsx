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
import { authenticate } from "~/shopify.server";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "~/db.server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Intent helpers ───────────────────────────────────────────────────────────

function extractOrderNumber(text: string): string | null {
  const match = text.match(/#?\b(\d{3,6})\b/);
  return match ? `#${match[1]}` : null;
}

function isOrderTrackingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\border\b/.test(lower) &&
    (/track|status|where|shipped|delivery|arrive|package|shipment/.test(lower) ||
      /#\d{3,}/.test(text))
  );
}

function isProductRecommendationIntent(text: string): boolean {
  return /recommend|suggest|show me|looking for|find me|what.*product|product.*recommend|popular|best seller/.test(
    text.toLowerCase(),
  );
}

function extractProductQuery(text: string): string {
  const stripped = text
    .toLowerCase()
    .replace(
      /recommend|suggest|show me|looking for|find me|what.*products?|best seller[s]?|popular/g,
      "",
    )
    .replace(/\?|please|can you|could you|i.*want|i.*need/g, "")
    .trim();
  return stripped || "popular products";
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

  // Authenticate via app proxy HMAC (throws on invalid signature)
  let shop: string;
  let adminCtx: AdminApiContext | undefined;

  try {
    const ctx = await authenticate.public.appProxy(request);
    shop = ctx.session?.shop ?? "";
    adminCtx = ctx.admin ?? undefined;
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  if (!shop) {
    return Response.json({ error: "Could not determine shop" }, { status: 400, headers: CORS });
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

  // ── Find or create conversation ──
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

  // ── Intent detection + Shopify data ──
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

  // ── History ──
  const history = conv.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // ── System prompt ──
  const systemPrompt = [
    `You are ShopMate, a helpful AI assistant for the Shopify store ${shop}. Help customers with order tracking, product recommendations, returns, and general questions. Be friendly, concise, and helpful.`,
    extraContext ? `\nCONTEXT:\n${extraContext}` : "",
    products.length > 0 ? "\nPresent product cards after your reply. Briefly introduce them." : "",
  ]
    .filter(Boolean)
    .join("\n");

  // ── Call Anthropic ──
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
