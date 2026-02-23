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
    if (request.method !== "POST") {
      console.error("[feedback] Non-POST request method:", request.method);
      return new Response("Method not allowed", { status: 405 });
    }

    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    if (!shop) {
      console.error("[feedback] No shop in session");
      return redirect("/app?feedback=error");
    }

    console.log(`[feedback] POST received from shop: ${shop}`);

    const formData = await request.formData();
    const message = (formData.get("message") as string | null)?.trim() ?? "";
    const email = (formData.get("email") as string | null)?.trim() || null;

    console.log(`[feedback] Parsed form: message length=${message.length}, email=${email ? "yes" : "no"}`);

    // Validate message
    if (!message) {
      console.warn(`[feedback] Validation FAILED: empty message`);
      return redirect("/app?feedback=error");
    }
    if (message.length > 5000) {
      console.warn(`[feedback] Validation FAILED: message too long (${message.length} chars)`);
      return redirect("/app?feedback=error");
    }

    // Fetch current plan from DB
    const settings = await prisma.shopSettings.findUnique({
      where: { shop },
      select: { plan: true },
    });
    const plan = settings?.plan ?? "free";
    console.log(`[feedback] Shop plan: ${plan}`);

    // BULLETPROOF: Save feedback to DB with explicit replied field
    // If this throws, it will be visible in Railway logs
    const savedFeedback = await prisma.feedback.create({
      data: {
        shop,
        message,
        email: email || null,
        plan,
        replied: false, // EXPLICITLY set default
      },
    });

    console.log(`[feedback] ✅ SUCCESS: Feedback saved with ID=${savedFeedback.id}`);

    // Redirect back to dashboard with success parameter
    return redirect("/app?feedback=success");
  } catch (err) {
    console.error(`[feedback] ❌ FAILURE in action:`, err);
    console.error(`[feedback] Error type: ${err instanceof Error ? err.constructor.name : typeof err}`);
    if (err instanceof Error) {
      console.error(`[feedback] Error message: ${err.message}`);
      console.error(`[feedback] Stack trace:\n${err.stack}`);
    }
    // DO NOT swallow — let Railway logs capture it
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
