import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (request.method !== "POST") {
    return redirect("/app/setup?error=invalid_method");
  }

  try {
    const formData = await request.formData();
    const step = formData.get("step") as string;

    if (step === "1") {
      // ── Step 1: Save bot name, greeting, tone ──
      const botName = (formData.get("botName") as string)?.trim() || "ShopMate";
      const greeting = (formData.get("greeting") as string)?.trim() || "Hi! 👋 How can I help you today?";
      const tone = (formData.get("tone") as string)?.trim() || "Friendly";

      await prisma.shopSettings.update({
        where: { shop },
        data: { botName, greeting, tone },
      });

      // Return to setup page with current URL params preserved
      const url = new URL(request.url);
      return redirect(`/app/setup?step=1&success=true${url.search.includes("host=") ? `&${url.search.substring(1)}` : ""}`);
    }

    if (step === "2") {
      // ── Step 2: Save quick action buttons selection ──
      const quickActionsStr = formData.get("quickActions") as string;
      const quickActions = quickActionsStr ? JSON.parse(quickActionsStr) : [];

      if (quickActions.length === 0) {
        const url = new URL(request.url);
        return redirect(`/app/setup?error=no_actions${url.search.includes("host=") ? `&${url.search.substring(1)}` : ""}`);
      }

      await prisma.shopSettings.update({
        where: { shop },
        data: { quickActions },
      });

      const url = new URL(request.url);
      return redirect(`/app/setup?step=2&success=true${url.search.includes("host=") ? `&${url.search.substring(1)}` : ""}`);
    }

    if (step === "3") {
      // ── Step 3: Mark setup as completed ──
      await prisma.shopSettings.update({
        where: { shop },
        data: { setupCompleted: true },
      });

      // Preserve host param for proper redirect back to embedded app
      const url = new URL(request.url);
      const hostParam = url.searchParams.get("host") ? `?host=${url.searchParams.get("host")}` : "";
      return redirect(`/app${hostParam}`);
    }

    return redirect(`/app/setup?error=unknown_step${new URL(request.url).search.includes("host=") ? `&${new URL(request.url).search.substring(1)}` : ""}`);
  } catch (err) {
    console.error(`[app.setup.save] Error saving setup:`, err);
    const url = new URL(request.url);
    return redirect(`/app/setup?error=save_failed${url.search.includes("host=") ? `&${url.search.substring(1)}` : ""}`);
  }
};
