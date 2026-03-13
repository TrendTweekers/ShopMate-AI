import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("[app.setup.save] ===== ACTION START =====");

  if (request.method !== "POST") {
    return jsonResponse({ error: "invalid_method" }, 405);
  }

  console.log("[app.setup.save] POST received, Content-Type:", request.headers.get("content-type"));

  try {
    // Parse JSON body (sent by direct fetch() from the client)
    const body = await request.json() as {
      step?: number | string;
      botName?: string;
      greeting?: string;
      tone?: string;
      quickActions?: string[];
      host?: string;
    };

    const step = String(body.step ?? "");
    const host = String(body.host ?? "");

    console.log("[app.setup.save] Body received - step:", step, "host:", host ? "yes" : "no");

    // ── Resolve shop from auth session or host param fallback ──
    let shop: string = "";
    let authSource = "none";

    try {
      const { session } = await authenticate.admin(request);
      shop = session.shop;
      authSource = "auth";
      console.log(`[app.setup.save] Auth source: ${authSource} → ${shop}`);
    } catch (authError) {
      // Auth failed — try host param fallback
      if (host) {
        try {
          const decoded = Buffer.from(host, "base64").toString("utf-8");
          if (decoded.includes("admin.shopify.com/store/")) {
            const storeName = decoded.split("admin.shopify.com/store/")[1];
            shop = `${storeName}.myshopify.com`;
            authSource = "base64_host";
          } else {
            shop = host;
            authSource = "raw_host";
          }
        } catch {
          shop = host;
          authSource = "raw_host";
        }
        console.log(`[app.setup.save] Auth fallback: ${authSource} → ${shop}`);
      }

      if (!shop) {
        console.log("[app.setup.save] No shop found — auth failed and no host");
        return jsonResponse({ error: "unauthenticated" }, 401);
      }
    }

    // ── Step 1: Bot name, greeting, tone ──
    if (step === "1") {
      const botName = (body.botName ?? "ShopMate").trim() || "ShopMate";
      const greeting = (body.greeting ?? "Hi! 👋 How can I help you today?").trim();
      const tone = (body.tone ?? "Friendly").trim() || "Friendly";

      console.log("[app.setup.save] Saving step 1:", { botName, greeting, tone });

      await prisma.shopSettings.upsert({
        where: { shop },
        update: { botName, greeting, tone, lastActiveAt: new Date() },
        create: { shop, botName, greeting, tone, lastActiveAt: new Date() },
      });

      console.log("[app.setup.save] ✅ Step 1 saved");
      return jsonResponse({ success: true, step: 1 });
    }

    // ── Step 2: Quick actions ──
    if (step === "2") {
      const quickActions = Array.isArray(body.quickActions) ? body.quickActions : [];

      console.log("[app.setup.save] Saving step 2 - quick actions:", quickActions);

      if (quickActions.length === 0) {
        return jsonResponse({ error: "no_actions" }, 400);
      }

      await prisma.shopSettings.upsert({
        where: { shop },
        update: { quickActions, lastActiveAt: new Date() },
        create: { shop, quickActions, lastActiveAt: new Date() },
      });

      console.log("[app.setup.save] ✅ Step 2 saved");
      return jsonResponse({ success: true, step: 2 });
    }

    // ── Step 3: Mark setup complete ──
    if (step === "3") {
      console.log("[app.setup.save] Saving step 3 - marking setup complete");

      await prisma.shopSettings.upsert({
        where: { shop },
        update: { setupCompleted: true, lastActiveAt: new Date() },
        create: { shop, setupCompleted: true, lastActiveAt: new Date() },
      });

      console.log("[app.setup.save] ✅ Step 3 saved — setup complete");
      return jsonResponse({ success: true, step: 3 });
    }

    console.log("[app.setup.save] Unknown step:", step);
    return jsonResponse({ error: "unknown_step" }, 400);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "no stack";
    console.error("[app.setup.save] ===== CRASH IN ACTION =====");
    console.error("[app.setup.save] Error message:", errorMsg);
    console.error("[app.setup.save] Error stack:", errorStack);
    console.error("[app.setup.save] Error type:", (err as { constructor?: { name?: string } })?.constructor?.name);
    return jsonResponse({ error: "save_failed", details: errorMsg }, 500);
  }
};
