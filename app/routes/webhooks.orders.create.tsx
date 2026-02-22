/**
 * Webhook: ORDERS_CREATE
 *
 * Fires when a new order is placed on the store. We use this to close
 * the revenue attribution loop: if any line item's product was clicked
 * in a ShopMate chat within the last 24 hours, we attribute the revenue.
 *
 * Attribution window: 24 hours (configurable via ATTRIBUTION_WINDOW_HOURS env var).
 * Strategy: earliest unattributed click for each product in the order.
 *
 * The widget appends ?shopmate_ref={conversationId} to product URLs.
 * Shopify surfaces this in order.landing_site (query string) or
 * order.referring_site. We check both, plus the raw product match.
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";

const ATTRIBUTION_WINDOW_HOURS =
  parseInt(process.env.ATTRIBUTION_WINDOW_HOURS ?? "24", 10) || 24;

// ── Shopify order webhook shape (only the fields we need) ─────────────────────
interface OrderLineItem {
  product_id: number | null;
  variant_id: number | null;
  price: string;
  quantity: number;
  title: string;
}

interface ShopifyOrderPayload {
  id: number;
  total_price: string;
  landing_site?: string | null;
  referring_site?: string | null;
  line_items: OrderLineItem[];
}

// ── Helper: extract shopmate_ref from landing_site URL ────────────────────────
function extractRef(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    // landing_site can be a path like "/products/foo?shopmate_ref=abc123"
    // Prepend a dummy origin so URL can parse it.
    const full = url.startsWith("http") ? url : `https://x.com${url}`;
    return new URL(full).searchParams.get("shopmate_ref");
  } catch {
    return null;
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} for shop: ${shop}`);

  const order = payload as ShopifyOrderPayload;
  if (!order?.line_items?.length) {
    return new Response(null, { status: 200 });
  }

  const orderId      = `gid://shopify/Order/${order.id}`;
  const orderValue   = parseFloat(order.total_price) || 0;
  const windowStart  = new Date(Date.now() - ATTRIBUTION_WINDOW_HOURS * 3_600_000);

  // Check if the order carries a shopmate_ref directly
  const refFromOrder =
    extractRef(order.landing_site) ?? extractRef(order.referring_site);

  for (const item of order.line_items) {
    if (!item.product_id) continue;

    const productGid = `gid://shopify/Product/${item.product_id}`;
    const itemRevenue = parseFloat(item.price) * item.quantity;

    // Find the earliest unattributed click for this product
    // within the attribution window, optionally filtered by conversationId.
    const whereClause: Parameters<typeof prisma.chatAttribution.findFirst>[0] = {
      where: {
        shop,
        productId: productGid,
        orderId: null,  // not yet attributed
        clickedAt: { gte: windowStart },
        ...(refFromOrder ? { conversationId: refFromOrder } : {}),
      },
      orderBy: { clickedAt: "asc" as const },
    };

    const attribution = await prisma.chatAttribution.findFirst(whereClause);

    if (attribution) {
      await prisma.chatAttribution.update({
        where: { id: attribution.id },
        data: {
          orderId: orderId,
          orderValue: orderValue,
          attributedRevenue: itemRevenue,
          attributedAt: new Date(),
        },
      });
      console.log(
        `[Webhook] Attribution: conv=${attribution.conversationId} product=${attribution.productTitle} rev=${itemRevenue}`,
      );
    }
  }

  return new Response(null, { status: 200 });
};
