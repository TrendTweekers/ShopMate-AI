/**
 * /app/billing — Shopify Billing upgrade route.
 *
 * When a merchant clicks "Upgrade to Pro" in the dashboard, they land here.
 * The loader immediately requests a recurring charge via shopify.billing.request
 * and redirects to the Shopify payment confirmation page.
 * On approval Shopify redirects back to the app (returnUrl = /app).
 *
 * IMPORTANT: This route must be reached via a full page navigation (not a
 * React Router client-side data fetch). The dashboard uses shopify.navigate()
 * from App Bridge to ensure the ?host= and session token are present in the
 * URL so authenticate.admin() can verify the request. A React Router
 * navigate() call would trigger a /app/billing.data fetch with no session
 * token, causing a 401.
 */
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useRouteError } from "react-router";
import { authenticate, MONTHLY_PLAN } from "~/shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

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

  // Request the charge — Shopify returns a confirmationUrl and the SDK
  // throws a redirect Response to it internally.
  await billing.request({
    plan: MONTHLY_PLAN,
    isTest: process.env.NODE_ENV !== "production",
    // returnUrl is handled automatically by the SDK (redirects back to the app)
  });

  // billing.request() redirects internally; this line is unreachable
  return redirect("/app");
};

// Re-export boundary headers so the CSP / X-Frame-Options headers are set
// correctly for this embedded route.
export const headers = (headersArgs: Parameters<typeof boundary.headers>[0]) =>
  boundary.headers(headersArgs);

// Handle auth errors (e.g. if somehow reached without a session token).
export function ErrorBoundary() {
  const error = useRouteError();
  return boundary.error(error);
}
