/**
 * Unified GDPR / privacy-law compliance webhook handler.
 *
 * Shopify sends all three mandatory compliance topics to this single endpoint:
 *   - customers/data_request  — customer requests data export
 *   - customers/redact        — customer requests data deletion
 *   - shop/redact             — shop data deletion (48 days after uninstall)
 *
 * HMAC verification is handled automatically by authenticate.webhook().
 * The [webhooks.subscriptions] compliance_topics entry in shopify.app.toml
 * points all three topics to this route.
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`[Compliance Webhook] ${topic} received for shop: ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // Customer requested an export of their data.
      // We don't store any customer PII — conversations are keyed by anonymous
      // session ID, not by Shopify customer ID. Nothing to export.
      console.log(`[Compliance Webhook] customers/data_request — no PII stored for shop: ${shop}`);
      break;

    case "CUSTOMERS_REDACT":
      // Customer requested deletion of their data.
      // Delete all conversation data for this shop (sessions are anonymous).
      await db.conversation.deleteMany({ where: { shop } });
      console.log(`[Compliance Webhook] customers/redact — conversations deleted for shop: ${shop}`);
      break;

    case "SHOP_REDACT":
      // Merchant uninstalled 48 days ago — delete ALL shop data.
      await db.chatAttribution.deleteMany({ where: { shop } });
      await db.conversation.deleteMany({ where: { shop } });
      await db.knowledgeBase.deleteMany({ where: { shop } });
      await db.shopSettings.deleteMany({ where: { shop } });
      await db.session.deleteMany({ where: { shop } });
      console.log(`[Compliance Webhook] shop/redact — all data purged for shop: ${shop}`);
      break;

    default:
      console.warn(`[Compliance Webhook] Unknown topic: ${topic} for shop: ${shop}`);
  }

  return new Response(null, { status: 200 });
};
