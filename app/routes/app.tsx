import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, Link } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Destructuring `session` is required so the SDK registers a session record
  // in the DB — needed for Shopify's App Store review check
  // "Using session tokens for user authentication".
  const { session } = await authenticate.admin(request);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
  };
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <Link to="/app">Dashboard</Link>
        <Link to="/app/setup">Setup Wizard</Link>
        <Link to="/app/order-tracking">Order Tracking</Link>
        <Link to="/app/recommendations">Recommendations</Link>
        <Link to="/app/knowledge">Knowledge Base</Link>
        <Link to="/app/escalation">Escalation</Link>
        <Link to="/app/conversations">Conversations</Link>
        <Link to="/app/widget-preview">Widget Preview</Link>
        <Link to="/app/customize">Customize</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export const headers = (headersArgs: Parameters<typeof boundary.headers>[0]) =>
  boundary.headers(headersArgs);

// NOTE: No ErrorBoundary on the layout route.
//
// boundary.error() renders a <div> WITHOUT AppProvider/NavMenu. When it fires
// on first-load auth (authenticate.admin throws a redirect), App Bridge sees
// NavMenu vanish and permanently removes all nav items from the Shopify Admin
// sidebar — they never come back until the merchant reinstalls.
//
// Instead, auth redirect Responses bubble up to root.tsx's ErrorBoundary which
// re-throws raw Response objects so React Router executes the redirect natively.
// Child routes each export their own boundary.error() ErrorBoundary for their
// own loader/action errors.
