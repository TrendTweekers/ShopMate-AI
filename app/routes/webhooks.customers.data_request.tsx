/**
 * GDPR / Privacy-law mandatory webhook: customers/data_request
 *
 * Shopify sends this when a customer requests an export of their data.
 * We acknowledge receipt with a 200. We do not store any customer PII
 * that would need to be exported — conversations are keyed by anonymous
 * session ID, not by customer account.
 *
 * HMAC verification is handled automatically by authenticate.webhook().
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} received for shop: ${shop}`);
  // No customer PII stored — nothing to export.
  return new Response(null, { status: 200 });
};
