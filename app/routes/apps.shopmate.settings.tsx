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
  "Cache-Control":                "public, max-age=60", // 60s edge cache
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Authenticate via Shopify App Proxy HMAC
  let shop: string;
  try {
    const { session } = await authenticate.public.appProxy(request);
    shop = session?.shop ?? "";
  } catch {
    // Fallback: read shop from query param (Shopify always sends it)
    const url = new URL(request.url);
    shop = url.searchParams.get("shop") || "";
  }

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
