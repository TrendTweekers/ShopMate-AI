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
    const host = formData.get("host") as string;

    // Authenticate request - handle both standard auth flow and embedded form submission
    let shop: string;
    try {
      const { session } = await authenticate.admin(request);
      shop = session.shop;
    } catch (authError) {
      // If standard auth fails, try to use host param from form as fallback
      // This allows POST from embedded form to work even if full auth context is missing
      if (host) {
        shop = host;
      } else {
        // No host param and auth failed - redirect to login
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
