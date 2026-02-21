import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";

declare global {
  interface Window {
    __SHOPIFY_APP_API_KEY?: string;
  }
}

export default function AppLayout() {
  const [apiKey, setApiKey] = useState<string>("");

  useEffect(() => {
    const fromWindow = window.__SHOPIFY_APP_API_KEY || "";
    const fromMeta =
      document
        .querySelector('meta[name="shopify-api-key"]')
        ?.getAttribute("content") || "";

    setApiKey(fromWindow || fromMeta || "");
  }, []);

  // SSR render + first client render (before useEffect)
  if (!apiKey) return null;

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <a href="/app">Home</a>
        <a href="/app/chat">Chat Preview</a>
        <a href="/app/settings">Settings</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}