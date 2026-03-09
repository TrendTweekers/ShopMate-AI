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

    // Decode host if it's base64 encoded (Shopify may encode the admin URL)
    let shop: string = "";
    if (host) {
      try {
        // Try to decode as base64
        const decoded = Buffer.from(host, "base64").toString("utf-8");
        // If decoded contains "admin.shopify.com/store/", extract the store name
        if (decoded.includes("admin.shopify.com/store/")) {
          const storeName = decoded.split("admin.shopify.com/store/")[1];
          shop = `${storeName}.myshopify.com`;
          console.log(`[app.setup.save] Decoded host from base64: ${storeName}.myshopify.com`);
        } else {
          // Not admin URL, use host as-is (might already be shop domain)
          shop = host;
          console.log(`[app.setup.save] Using host directly: ${shop}`);
        }
      } catch {
        // Not base64 or couldn't decode, use as-is
        shop = host;
        console.log(`[app.setup.save] Using host as-is (not base64): ${shop}`);
      }
    }

    // If we don't have a shop from host param, try standard auth
    if (!shop) {
      try {
        const { session } = await authenticate.admin(request);
        shop = session.shop;
        console.log(`[app.setup.save] Auth succeeded for shop: ${shop}`);
      } catch (authError) {
        // No auth and no host param
        console.log(`[app.setup.save] Auth failed and no host param - redirecting to login`);
        return redirect("/auth/login");
      }
    } else {
      // We have shop from host param, but try auth anyway for better context
      try {
        const { session } = await authenticate.admin(request);
        console.log(`[app.setup.save] Auth succeeded for shop: ${session.shop}`);
      } catch (authError) {
        // Auth failed but we have shop from host, so continue
        console.log(`[app.setup.save] Auth failed but using shop from host: ${shop}`);
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

      return redirect(buildRedirectUrl("/app/setup", "step=1&success=true", host));
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

      return redirect(buildRedirectUrl("/app/setup", "step=2&success=true", host));
    }

    if (step === "3") {
      // ── Step 3: Mark setup as completed ──
      // Use upsert to create if doesn't exist, update if does
      await prisma.shopSettings.upsert({
        where: { shop },
        update: { setupCompleted: true, lastActiveAt: new Date() },
        create: { shop, setupCompleted: true, lastActiveAt: new Date() },
      });

      // Redirect to dashboard with Shopify context
      return redirect(host ? `/app?host=${encodeURIComponent(host)}` : "/app");
    }

    return redirect(buildRedirectUrl("/app/setup", "error=unknown_step", host));
  } catch (err) {
    console.error(`[app.setup.save] Error saving setup:`, err);
    return redirect("/app/setup?error=save_failed");
  }
};
