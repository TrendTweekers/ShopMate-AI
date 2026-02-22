import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData } from "react-router";
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
        <a href="/app">Dashboard</a>
        <a href="/app/setup">Setup Wizard</a>
        <a href="/app/order-tracking">Order Tracking</a>
        <a href="/app/recommendations">Recommendations</a>
        <a href="/app/knowledge">Knowledge Base</a>
        <a href="/app/escalation">Escalation</a>
        <a href="/app/conversations">Conversations</a>
        <a href="/app/widget-preview">Widget Preview</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export const headers = (headersArgs: Parameters<typeof boundary.headers>[0]) =>
  boundary.headers(headersArgs);

// NOTE: No ErrorBoundary on this layout route intentionally.
//
// boundary.error() in a LAYOUT route (app.tsx) replaces the entire
// AppProvider + NavMenu tree when triggered — App Bridge then sees the
// NavMenu disappear and permanently clears the sidebar nav in Shopify Admin.
//
// Auth redirects (authenticate.admin throwing a Response on first load) are
// handled by:
//   1. root.tsx ErrorBoundary: re-throws Response objects so React Router
//      handles the redirect natively (isRouteErrorResponse guard).
//   2. Child route ErrorBoundaries (app._index.tsx, app.billing.tsx, etc.)
//      each export boundary.error() — they handle the redirect via App Bridge
//      postMessage without touching the layout or NavMenu.
