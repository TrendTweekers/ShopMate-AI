/**
 * GDPR / Privacy-law mandatory webhook: customers/redact
 *
 * Shopify sends this when a customer requests deletion of their data.
 * We delete all Conversation (and cascade-deleted Message) rows that are
 * associated with the shop.  Sessions are anonymous so we cannot narrow
 * by customer ID, but deleting all shop conversations satisfies the
 * requirement conservatively.
 *
 * HMAC verification is handled automatically by authenticate.webhook().
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} received for shop: ${shop}`);

  // Delete conversation data (Messages cascade via Prisma relation)
  await db.conversation.deleteMany({ where: { shop } });

  return new Response(null, { status: 200 });
};
