import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Extract a Shopify order name like #1234 from a string */
function extractOrderNumber(text: string): string | null {
  const match = text.match(/#?\b(\d{3,6})\b/);
  return match ? `#${match[1]}` : null;
}

/** Detect if the user is asking about order tracking */
function isOrderTrackingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\border\b/.test(lower) &&
    (/track|status|where|shipped|delivery|arrive|package|shipment/.test(lower) ||
      /#\d{3,}/.test(text))
  );
}

/** Detect if the user wants product recommendations */
function isProductRecommendationIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return /recommend|suggest|show me|looking for|find me|what.*product|product.*recommend|popular|best seller/.test(
    lower,
  );
}

/** Extract a keyword from a recommendation request */
function extractProductQuery(text: string): string {
  const lower = text.toLowerCase();
  // Strip common filler phrases to get the core product query
  const stripped = lower
    .replace(/recommend|suggest|show me|looking for|find me|what.*products?|best seller[s]?|popular/g, "")
    .replace(/\?|please|can you|could you|i.*want|i.*need/g, "")
    .trim();
  return stripped || "popular products";
}

// ─── GraphQL Queries ────────────────────────────────────────────────────────

const ORDER_QUERY = `#graphql
  query GetOrder($query: String!) {
    orders(first: 1, query: $query) {
      nodes {
        name
        displayFinancialStatus
        displayFulfillmentStatus
        createdAt
        currentTotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        shippingAddress {
          city
          province
          country
        }
        fulfillments(first: 1) {
          trackingInfo(first: 1) {
            number
            url
            company
          }
          displayStatus
          estimatedDeliveryAt
        }
        lineItems(first: 5) {
          nodes {
            title
            quantity
          }
        }
      }
    }
  }
`;

const PRODUCTS_QUERY = `#graphql
  query GetProducts($query: String!) {
    products(first: 5, query: $query) {
      edges {
        node {
          id
          title
          handle
          featuredImage {
            url
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;

// ─── Context Builders ───────────────────────────────────────────────────────

async function fetchOrderContext(
  admin: { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> },
  orderNumber: string,
): Promise<string> {
  try {
    const response = await admin.graphql(ORDER_QUERY, {
      variables: { query: `name:${orderNumber}` },
    });
    const json = (await response.json()) as {
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
    if (!order) {
      return `No order found with number ${orderNumber}. Please verify the order number and try again.`;
    }

    const fulfillment = order.fulfillments?.[0];
    const tracking = fulfillment?.trackingInfo?.[0];
    const items = order.lineItems?.nodes
      ?.map((li) => `${li.quantity}x ${li.title}`)
      .join(", ");
    const addr = order.shippingAddress;
    const price = order.currentTotalPriceSet?.shopMoney;

    let context = `ORDER FOUND — ${order.name}:
- Financial status: ${order.displayFinancialStatus || "unknown"}
- Fulfillment status: ${order.displayFulfillmentStatus || "unfulfilled"}
- Order date: ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "unknown"}
- Total: ${price ? `${price.amount} ${price.currencyCode}` : "unknown"}
- Items: ${items || "unknown"}`;

    if (addr) {
      context += `\n- Shipping to: ${[addr.city, addr.province, addr.country].filter(Boolean).join(", ")}`;
    }

    if (fulfillment) {
      context += `\n- Fulfillment status: ${fulfillment.displayStatus || "unknown"}`;
      if (fulfillment.estimatedDeliveryAt) {
        context += `\n- Estimated delivery: ${new Date(fulfillment.estimatedDeliveryAt).toLocaleDateString()}`;
      }
    }

    if (tracking) {
      context += `\n- Tracking: ${tracking.number || "N/A"} via ${tracking.company || "carrier"}`;
      if (tracking.url) context += ` (${tracking.url})`;
    }

    return context;
  } catch (err) {
    console.error("Order fetch error:", err);
    return "I was unable to retrieve order information at this time. Please try again.";
  }
}

interface ProductResult {
  id: string;
  title: string;
  price: string;
  image: string | null;
  url: string;
}

async function fetchProducts(
  admin: { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> },
  query: string,
  shop: string,
): Promise<{ context: string; products: ProductResult[] }> {
  try {
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: { query },
    });
    const json = (await response.json()) as {
      data?: {
        products?: {
          edges?: Array<{
            node?: {
              id?: string;
              title?: string;
              handle?: string;
              featuredImage?: { url?: string } | null;
              priceRangeV2?: { minVariantPrice?: { amount?: string; currencyCode?: string } };
            };
          }>;
        };
      };
    };

    const edges = json?.data?.products?.edges ?? [];
    const nodes = edges.map((e) => e.node).filter((n): n is NonNullable<typeof n> => n != null);

    if (nodes.length === 0) {
      return { context: "No products found matching that query.", products: [] };
    }

    const products: ProductResult[] = nodes.map((p) => {
      const price = p.priceRangeV2?.minVariantPrice;
      const amount = price?.amount ? parseFloat(price.amount).toFixed(2) : "0.00";
      const currency = price?.currencyCode ?? "USD";
      return {
        id: p.id ?? "",
        title: p.title ?? "Product",
        price: `${currency} ${amount}`,
        image: p.featuredImage?.url ?? null,
        url: `https://${shop}/products/${p.handle ?? ""}`,
      };
    });

    const context = `RECOMMENDED PRODUCTS:\n${products
      .map((p) => `- ${p.title} at ${p.price}`)
      .join("\n")}`;

    return { context, products };
  } catch (err) {
    console.error("Products fetch error:", err);
    return { context: "Unable to fetch product recommendations right now.", products: [] };
  }
}

// ─── Action ─────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { message, conversationId, shop: clientShop } = await request.json();
  const shop = session.shop ?? clientShop;

  // ── Find or create conversation ──
  let conversation = conversationId
    ? await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
    : await prisma.conversation.create({
        data: { shop: session.shop, sessionId: session.id },
        include: { messages: true },
      });

  // ── Save user message ──
  await prisma.message.create({
    data: { conversationId: conversation!.id, role: "user", content: message },
  });

  // ── Build message history for Anthropic ──
  const history = (conversation!.messages ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // ── Detect intent and fetch contextual data ──
  let extraContext = "";
  let products: ProductResult[] = [];

  if (isOrderTrackingIntent(message)) {
    const orderNumber = extractOrderNumber(message);
    if (orderNumber) {
      extraContext = await fetchOrderContext(admin, orderNumber);
    } else {
      extraContext =
        "The customer is asking about order tracking but did not provide an order number. Ask them to provide their order number (e.g. #1234).";
    }
  } else if (isProductRecommendationIntent(message)) {
    const productQuery = extractProductQuery(message);
    const result = await fetchProducts(admin, productQuery, shop);
    extraContext = result.context;
    products = result.products;
  }

  // ── System prompt ──
  const systemPrompt = [
    `You are ShopMate, a helpful AI assistant for the Shopify store ${shop}. You help customers with order tracking, product recommendations, returns, and general questions. Be friendly, concise, and helpful.`,
    extraContext ? `\nCURRENT CONTEXT:\n${extraContext}` : "",
    products.length > 0
      ? "\nYou are presenting product cards below your message. Briefly introduce the recommendations."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  // ── Call Anthropic ──
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [...history, { role: "user", content: message }],
  });

  const assistantMessage =
    response.content[0].type === "text"
      ? response.content[0].text
      : "Sorry, I could not process that.";

  // ── Save assistant response ──
  await prisma.message.create({
    data: {
      conversationId: conversation!.id,
      role: "assistant",
      content: assistantMessage,
    },
  });

  return Response.json({
    reply: assistantMessage,
    conversationId: conversation!.id,
    products: products.length > 0 ? products : undefined,
  });
};
