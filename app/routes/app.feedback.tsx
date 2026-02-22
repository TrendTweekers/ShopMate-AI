/**
 * /app/feedback — Feedback submission action
 *
 * Accepts a POST from the dashboard FeedbackModal:
 *   message  (required, max 5000 chars)
 *   email    (optional)
 *
 * Saves feedback to the DB (Feedback table).
 * Redirects back to /app with ?feedback=success on success
 * Redirects back to /app with ?feedback=error on failure
 */

import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;
    console.log(`[feedback] Starting feedback submission from shop: ${shop}`);

    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const formData = await request.formData();
    const message = (formData.get("message") as string | null)?.trim() ?? "";
    const email = (formData.get("email") as string | null)?.trim() || null;

    console.log(`[feedback] Message length: ${message.length}, Email: ${email ? "provided" : "empty"}`);

    // Validate
    if (!message) {
      console.log("[feedback] Validation failed: no message");
      return redirect("/app?feedback=error");
    }
    if (message.length > 5000) {
      console.log("[feedback] Validation failed: message too long");
      return redirect("/app?feedback=error");
    }

    // Fetch current plan from DB
    const settings = await prisma.shopSettings.findUnique({
      where: { shop },
      select: { plan: true },
    });
    const plan = settings?.plan ?? "free";
    console.log(`[feedback] Plan: ${plan}`);

    // Save feedback to DB
    const savedFeedback = await prisma.feedback.create({
      data: { shop, message, email, plan },
    });

    console.log(`[feedback] ✅ Feedback saved successfully with ID: ${savedFeedback.id}`);

    // Redirect back to dashboard with success parameter
    return redirect("/app?feedback=success");
  } catch (err) {
    console.error("[feedback] ❌ Error:", err instanceof Error ? err.message : String(err));
    if (err instanceof Error) {
      console.error("[feedback] Stack:", err.stack);
    }
    return redirect("/app?feedback=error");
  }
};

// This route has no GET / no UI — return 405 for non-POST requests.
export const loader = async () => {
  return new Response("Method Not Allowed", { status: 405 });
};

export const headers = (headersArgs: Parameters<typeof boundary.headers>[0]) =>
  boundary.headers(headersArgs);

export const errorBoundary = boundary.error;

// Dummy component — this route is action-only (POST to /app/feedback)
export default function FeedbackAction() {
  return null;
}
