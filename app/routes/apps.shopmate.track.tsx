/**
 * Public App Proxy endpoint: /apps/shopmate/track
 *
 * Called by chat-widget.js when a customer clicks a product card.
 * Records a ChatAttribution row so the ORDERS_CREATE webhook can
 * close the attribution loop later.
 *
 * Body: { conversationId, productId, productHandle, productTitle }
 * Response: { ok: true } — always 200 so the widget never blocks.
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Authenticate via HMAC (same as /chat)
  let shop: string;
  try {
    const ctx = await authenticate.public.appProxy(request);
    shop = ctx.session?.shop ?? "";
  } catch {
    // Never block the widget — just log and move on
    return Response.json({ ok: false, error: "auth" }, { status: 200, headers: CORS });
  }

  if (!shop) {
    return Response.json({ ok: false, error: "no_shop" }, { status: 200, headers: CORS });
  }

  let body: {
    conversationId?: string;
    productId?: string;
    productHandle?: string;
    productTitle?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 200, headers: CORS });
  }

  const { conversationId, productId, productHandle, productTitle } = body;

  if (!conversationId || !productId) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 200, headers: CORS });
  }

  try {
    await prisma.chatAttribution.create({
      data: {
        shop,
        conversationId,
        productId,
        productHandle: productHandle ?? "",
        productTitle: productTitle ?? "",
      },
    });
    console.log(`[track] Click recorded: shop=${shop} product=${productHandle} conv=${conversationId}`);
  } catch (err) {
    console.error("[track] Failed to record click:", err);
  }

  return Response.json({ ok: true }, { headers: CORS });
};
