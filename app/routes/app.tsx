import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
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
      <s-app-nav>
        <s-link href="/app" rel="home">Dashboard</s-link>
        <s-link href="/app/conversations">Conversations</s-link>
        <s-link href="/app/order-tracking">Order Tracking</s-link>
        <s-link href="/app/recommendations">Recommendations</s-link>
        <s-link href="/app/knowledge">Knowledge Base</s-link>
        <s-link href="/app/setup">Setup Wizard</s-link>
        <s-link href="/app/widget-preview">Widget Preview</s-link>
      </s-app-nav>
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
