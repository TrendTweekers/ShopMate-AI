/**
 * Public App Proxy endpoint: /apps/shopmate/widget-theme
 *
 * Returns ONLY the 6 widget color fields for the storefront chat-widget.js.
 * Kept separate from /settings so it's a small, fast, focused response.
 * Cache-Control: no-store so color changes appear immediately.
 */

import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
  "Cache-Control":                "no-store, private",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const reqUrl = new URL(request.url);

  // Authenticate via App Proxy HMAC, fall back to ?shop= param
  let shop = "";
  try {
    const { session } = await authenticate.public.appProxy(request);
    shop = session?.shop ?? "";
  } catch { /* fall through */ }
  if (!shop) shop = reqUrl.searchParams.get("shop") ?? "";

  console.log("[apps.shopmate.widget-theme] shop:", shop || "(empty)");

  if (!shop) {
    return new Response(JSON.stringify({ error: "shop param required" }), { status: 400, headers: CORS });
  }

  const settings = await prisma.shopSettings.findUnique({
    where:  { shop },
    select: {
      headerBgColor:   true,
      headerTextColor: true,
      bubbleBgColor:   true,
      bubbleTextColor: true,
      buttonBgColor:   true,
      buttonTextColor: true,
    },
  });

  const colors = {
    headerBgColor:   settings?.headerBgColor   ?? "#008060",
    headerTextColor: settings?.headerTextColor ?? "#ffffff",
    bubbleBgColor:   settings?.bubbleBgColor   ?? "#008060",
    bubbleTextColor: settings?.bubbleTextColor ?? "#ffffff",
    buttonBgColor:   settings?.buttonBgColor   ?? "#008060",
    buttonTextColor: settings?.buttonTextColor ?? "#ffffff",
  };

  console.log("[apps.shopmate.widget-theme] returning colors for", shop, ":", colors);
  return new Response(JSON.stringify(colors), { status: 200, headers: CORS });
};
