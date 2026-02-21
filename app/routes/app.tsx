import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // AppProvider from @shopify/shopify-app-react-router reads the `host`
  // query-param automatically from window.location.search — we do NOT pass
  // it as a prop (the type doesn't accept it).  We only need to return the
  // apiKey here so the provider can initialise App Bridge correctly and
  // derive the correct postMessage target origin (admin.shopify.com) from
  // the base64-encoded ?host= value that Shopify injects into every
  // embedded-app URL.
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
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
