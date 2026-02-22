/**
 * Webhook: APP_SUBSCRIPTIONS_UPDATE / APP_INSTALLED equivalent
 *
 * Shopify fires this webhook when a merchant installs (or re-installs) the app.
 * We use it to automatically import their store policies into the Knowledge Base
 * so the AI can reference them immediately.
 *
 * Topic: APP_SUBSCRIPTIONS_UPDATE does not exist as an install hook.
 * The correct topic in Shopify's webhook system is: app/uninstalled (covered elsewhere).
 *
 * For *install* we use the CUSTOMERS_DATA_REQUEST topic which isn't right either —
 * instead we hook into the authenticate.admin() flow via the afterAuth hook in
 * shopify.server.ts (see below). This file handles it if wired as a webhook,
 * but the primary path is afterAuth.
 *
 * Shopify topic to register: APP_SUBSCRIPTIONS_UPDATE
 * (fires on subscription changes; use afterAuth for clean install hook)
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import { importStorePolicies } from "~/lib/importStorePolicies.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin, topic } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} received for shop: ${shop}`);

  if (!admin) {
    console.warn("[Webhook] No admin context — cannot import policies");
    return new Response(null, { status: 200 });
  }

  try {
    const result = await importStorePolicies(shop, admin);
    console.log(
      `[Webhook] Policy import complete for ${shop}:`,
      result.imported,
      "imported,",
      result.skipped,
      "skipped",
      result.errors.length ? `| errors: ${result.errors.join(", ")}` : "",
    );
  } catch (err) {
    // Log but never return 5xx — Shopify would retry endlessly
    console.error("[Webhook] Policy import failed:", err);
  }

  return new Response(null, { status: 200 });
};
