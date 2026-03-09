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
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const formData = await request.formData();
    const step = formData.get("step") as string;
    const host = formData.get("host") as string;

    if (step === "1") {
      // ── Step 1: Save bot name, greeting, tone ──
      const botName = (formData.get("botName") as string)?.trim() || "ShopMate";
      const greeting = (formData.get("greeting") as string)?.trim() || "Hi! 👋 How can I help you today?";
      const tone = (formData.get("tone") as string)?.trim() || "Friendly";

      await prisma.shopSettings.update({
        where: { shop },
        data: { botName, greeting, tone },
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

      await prisma.shopSettings.update({
        where: { shop },
        data: { quickActions },
      });

      return redirect(buildRedirectUrl("/app/setup", "step=2&success=true", host));
    }

    if (step === "3") {
      // ── Step 3: Mark setup as completed ──
      await prisma.shopSettings.update({
        where: { shop },
        data: { setupCompleted: true },
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
