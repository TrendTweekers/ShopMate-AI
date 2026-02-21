/**
 * /app/billing — Shopify Billing upgrade route.
 *
 * When a merchant clicks "Upgrade to Pro" in the dashboard, they land here.
 * The loader immediately requests a recurring charge via shopify.billing.request
 * and redirects to the Shopify payment confirmation page.
 * On approval Shopify redirects back to the app (returnUrl = /app).
 */
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate, MONTHLY_PLAN } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  const { hasActivePayment } = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest: process.env.NODE_ENV !== "production",
  });

  if (hasActivePayment) {
    // Already subscribed — bounce back to dashboard
    return redirect("/app");
  }

  // Request the charge — Shopify returns a confirmationUrl
  await billing.request({
    plan: MONTHLY_PLAN,
    isTest: process.env.NODE_ENV !== "production",
    // returnUrl is handled automatically by the SDK (redirects back to the app)
  });

  // billing.request() redirects internally; this line is unreachable
  return redirect("/app");
};
