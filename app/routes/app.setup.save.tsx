import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";

// Helper to build redirect URL with Shopify context
function buildRedirectUrl(basePath: string, params: string, host?: string): string {
  const hostParam = host ? `&host=${encodeURIComponent(host)}` : "";
  return `${basePath}?${params}${hostParam}`;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return redirect("/app/setup?error=invalid_method");
  }

  try {
    const formData = await request.formData();
    const step = formData.get("step") as string;

    // Get host from multiple sources (form data or URL query params)
    let host = formData.get("host") as string;
    if (!host) {
      // Fallback to URL query params (in case hidden input wasn't sent)
      const url = new URL(request.url);
      host = url.searchParams.get("host") || "";
    }

    // Get shop identifier from auth or host param fallback
    let shop: string = "";
    let authSource = "none";

    // Try standard auth first
    try {
      const { session } = await authenticate.admin(request);
      shop = session.shop;
      authSource = "auth";
      console.log(`[app.setup.save] Auth source: ${authSource} → ${shop}`);
    } catch (authError) {
      // Auth failed, try fallback with host param
      if (host) {
        try {
          // Try to decode as base64
          const decoded = Buffer.from(host, "base64").toString("utf-8");
          // If decoded contains "admin.shopify.com/store/", extract the store name
          if (decoded.includes("admin.shopify.com/store/")) {
            const storeName = decoded.split("admin.shopify.com/store/")[1];
            shop = `${storeName}.myshopify.com`;
            authSource = "base64_host";
            console.log(`[app.setup.save] Auth source: ${authSource} → ${shop}`);
          } else {
            // Not admin URL, use host as-is
            shop = host;
            authSource = "raw_host";
            console.log(`[app.setup.save] Auth source: ${authSource} → ${shop}`);
          }
        } catch {
          // Not base64 or couldn't decode, use as-is
          shop = host;
          authSource = "raw_host";
          console.log(`[app.setup.save] Auth source: ${authSource} (not base64) → ${shop}`);
        }
      }

      if (!shop) {
        console.log(`[app.setup.save] Failed: No shop found (auth failed + no host), redirecting to login`);
        return redirect("/auth/login");
      }
    }

    if (step === "1") {
      // ── Step 1: Save bot name, greeting, tone ──
      const botName = (formData.get("botName") as string)?.trim() || "ShopMate";
      const greeting = (formData.get("greeting") as string)?.trim() || "Hi! 👋 How can I help you today?";
      const tone = (formData.get("tone") as string)?.trim() || "Friendly";

      // Use upsert to create if doesn't exist, update if does
      await prisma.shopSettings.upsert({
        where: { shop },
        update: { botName, greeting, tone, lastActiveAt: new Date() },
        create: { shop, botName, greeting, tone, lastActiveAt: new Date() },
      });

      console.log(`[app.setup.save] Step 1 saved, redirecting back to setup with host`);
      return redirect(buildRedirectUrl("/app/setup", "saved=1", host));
    }

    if (step === "2") {
      // ── Step 2: Save quick action buttons selection ──
      const quickActionsStr = formData.get("quickActions") as string;
      const quickActions = quickActionsStr ? JSON.parse(quickActionsStr) : [];

      if (quickActions.length === 0) {
        return redirect(buildRedirectUrl("/app/setup", "error=no_actions", host));
      }

      // Use upsert to create if doesn't exist, update if does
      await prisma.shopSettings.upsert({
        where: { shop },
        update: { quickActions, lastActiveAt: new Date() },
        create: { shop, quickActions, lastActiveAt: new Date() },
      });

      console.log(`[app.setup.save] Step 2 saved, redirecting back to setup with host`);
      return redirect(buildRedirectUrl("/app/setup", "saved=2", host));
    }

    if (step === "3") {
      // ── Step 3: Mark setup as completed ──
      // Use upsert to create if doesn't exist, update if does
      await prisma.shopSettings.upsert({
        where: { shop },
        update: { setupCompleted: true, lastActiveAt: new Date() },
        create: { shop, setupCompleted: true, lastActiveAt: new Date() },
      });

      console.log(`[app.setup.save] Setup completed, redirecting to dashboard with host`);
      // Redirect to dashboard with Shopify context
      return redirect(host ? `/app?host=${encodeURIComponent(host)}` : "/app");
    }

    return redirect(buildRedirectUrl("/app/setup", "error=unknown_step", host));
  } catch (err) {
    console.error(`[app.setup.save] Error saving setup:`, err);
    return redirect("/app/setup?error=save_failed");
  }
};
