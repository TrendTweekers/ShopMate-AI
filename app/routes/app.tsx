import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // authenticate.admin() validates the session token on every embedded request.
  // Destructuring `session` is required so the SDK registers a session record
  // in the DB — this is what Shopify's review checker looks for under
  // "Using session tokens for user authentication".
  const { session } = await authenticate.admin(request);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    // Expose shop downstream so child routes can read it without extra loaders.
    shop: session.shop,
  };
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">Dashboard</a>
        <a href="/app/conversations">Conversations</a>
        <a href="/app/knowledge">Knowledge Base</a>
        <a href="/app/customize">Customize</a>
        <a href="/app/setup">Setup Wizard</a>
        <a href="/app/billing">Billing</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export const headers = (headersArgs: Parameters<typeof boundary.headers>[0]) =>
  boundary.headers(headersArgs);

/**
 * Route-level ErrorBoundary for all /app/* routes.
 *
 * Uses boundary.error() from the Shopify SDK — it handles the case where
 * authenticate.admin() throws a redirect Response (e.g. to /auth on first
 * load). boundary.error() correctly re-issues the redirect inside the
 * embedded iframe context so App Bridge picks it up and navigates the top
 * frame to the Shopify OAuth flow instead of just showing an error page.
 *
 * Without this, the first-load "Something went wrong, works on refresh"
 * symptom occurs because:
 *   1. First load: no session token yet → authenticate.admin() throws a
 *      redirect Response to /auth
 *   2. Root ErrorBoundary catches it → shows error page
 *   3. Refresh: Shopify injects the token into the URL → auth succeeds
 *
 * boundary.error() handles the redirect correctly so step 2 becomes a
 * transparent redirect to OAuth instead of an error page.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  return boundary.error(error);
}
