import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    if (request.method !== "POST") {
      return redirect("/app/setup?error=invalid_method");
    }

    const formData = await request.formData();
    const step = formData.get("step") as string;
    const host = formData.get("host") as string;

    // Build query string with Shopify context
    const hostParam = host ? `&host=${encodeURIComponent(host)}` : "";
    const successParams = (q: string) => `/app/setup?${q}${hostParam}`;

    if (step === "1") {
      // ── Step 1: Save bot name, greeting, tone ──
      const botName = (formData.get("botName") as string)?.trim() || "ShopMate";
      const greeting = (formData.get("greeting") as string)?.trim() || "Hi! 👋 How can I help you today?";
      const tone = (formData.get("tone") as string)?.trim() || "Friendly";

      await prisma.shopSettings.update({
        where: { shop },
        data: { botName, greeting, tone },
      });

      return redirect(successParams("step=1&success=true"));
    }

    if (step === "2") {
      // ── Step 2: Save quick action buttons selection ──
      const quickActionsStr = formData.get("quickActions") as string;
      const quickActions = quickActionsStr ? JSON.parse(quickActionsStr) : [];

      if (quickActions.length === 0) {
        return redirect(successParams("error=no_actions"));
      }

      await prisma.shopSettings.update({
        where: { shop },
        data: { quickActions },
      });

      return redirect(successParams("step=2&success=true"));
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

    return redirect(successParams("error=unknown_step"));
  } catch (err) {
    console.error(`[app.setup.save] Error saving setup:`, err);
    return redirect(successParams("error=save_failed"));
  }
};
