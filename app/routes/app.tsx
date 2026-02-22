import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
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
        <a href="/app">Dashboard</a>
        <a href="/app/setup">Setup Wizard</a>
        <a href="/app/order-tracking">Order Tracking</a>
        <a href="/app/recommendations">Recommendations</a>
        <a href="/app/knowledge">Knowledge Base</a>
        <a href="/app/escalation">Escalation</a>
        <a href="/app/conversations">Conversations</a>
        <a href="/app/widget-preview">Widget Preview</a>
        <a href="/app/customize">Customize</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export const headers = (headersArgs: Parameters<typeof boundary.headers>[0]) =>
  boundary.headers(headersArgs);

// ErrorBoundary on the layout route ONLY handles auth redirects from the
// layout loader itself. boundary.error() fires a postMessage to App Bridge
// to trigger OAuth in the parent frame — it does NOT navigate React Router,
// so the NavMenu is NOT unmounted by this boundary triggering.
// Child routes each have their own boundary.error() for their own errors.
export function ErrorBoundary() {
  const error = useRouteError();
  return boundary.error(error);
}
