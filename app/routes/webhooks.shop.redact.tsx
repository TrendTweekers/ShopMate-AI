/**
 * GDPR / Privacy-law mandatory webhook: shop/redact
 *
 * Shopify sends this 48 days after a merchant uninstalls the app.
 * We must permanently delete all data stored for that shop.
 *
 * HMAC verification is handled automatically by authenticate.webhook().
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} received for shop: ${shop} — purging all shop data`);

  // Delete in dependency order to satisfy foreign-key constraints.
  // Conversation → Message is a cascade in Prisma, so deleting Conversation
  // also removes its Messages.
  await db.chatAttribution.deleteMany({ where: { shop } });
  await db.conversation.deleteMany({ where: { shop } });
  await db.knowledgeBase.deleteMany({ where: { shop } });
  await db.shopSettings.deleteMany({ where: { shop } });
  await db.session.deleteMany({ where: { shop } });

  console.log(`[Webhook] ${topic} — shop data purged for: ${shop}`);
  return new Response(null, { status: 200 });
};
