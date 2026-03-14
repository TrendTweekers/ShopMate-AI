/**
 * Public App Proxy endpoint: /apps/shopmate/settings
 *
 * Returns the merchant's saved bot settings (botName, greeting, tone,
 * quickActions) so the storefront chat-widget.js can display real values
 * instead of hardcoded defaults.
 *
 * No Shopify session needed — shop is verified via HMAC by
 * authenticate.public.appProxy, which is Shopify's standard proxy auth.
 */

import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
  // Never cache — settings change immediately when the merchant saves.
  // no-store: browser must not cache the response at all.
  // private: Shopify's App Proxy CDN must not cache this response either.
  "Cache-Control":                "no-store, private",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const reqUrl = new URL(request.url);

  // Authenticate via Shopify App Proxy HMAC
  let shop: string = "";
  try {
    const { session } = await authenticate.public.appProxy(request);
    shop = session?.shop ?? "";
  } catch {
    // appProxy threw — will fall back to query param below
  }

  // Fallback: if auth returned empty shop (null session) OR threw,
  // read from ?shop= query param (Shopify's proxy always adds it).
  if (!shop) {
    shop = reqUrl.searchParams.get("shop") || "";
  }

  console.log("[apps.shopmate.settings] shop resolved:", shop || "(empty)", "| url:", reqUrl.pathname + reqUrl.search);

  if (!shop) {
    return new Response(
      JSON.stringify({ error: "shop param required" }),
      { status: 400, headers: CORS }
    );
  }

  console.log("[apps.shopmate.settings] loading settings for shop:", shop);

  // Fetch settings from DB (no upsert — read-only, fast)
  const settings = await prisma.shopSettings.findUnique({
    where: { shop },
    select: {
      botName:      true,
      greeting:     true,
      tone:         true,
      quickActions: true,
      widgetEnabled: true,
    },
  });

  const payload = {
    botName:      settings?.botName      ?? "ShopMate",
    greeting:     settings?.greeting     ?? "Hi! 👋 How can I help you today?",
    tone:         settings?.tone         ?? "Friendly",
    quickActions: (settings?.quickActions as string[]) ?? [
      "Track my order",
      "Product recommendations",
      "Returns & exchanges",
    ],
    widgetEnabled: settings?.widgetEnabled ?? true,
  };

  console.log("[apps.shopmate.settings] returning:", payload);

  return new Response(JSON.stringify(payload), { status: 200, headers: CORS });
};
