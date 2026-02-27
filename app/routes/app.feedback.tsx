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

    console.log("[feedback] Attempting to authenticate admin request");
    let shop: string | null = null;

    try {
      const { session } = await authenticate.admin(request);
      shop = session.shop;
      console.log(`[feedback] ✅ Authentication successful, shop: ${shop}`);
    } catch (authErr) {
      console.error("[feedback] ⚠️ Authentication threw error:", authErr instanceof Error ? authErr.message : String(authErr));
      // Authentication failed - try to extract shop from URL params as fallback
      const url = new URL(request.url);
      const shopParam = url.searchParams.get("shop");
      console.log(`[feedback] Fallback shop from URL param: ${shopParam}`);

      if (!shopParam) {
        console.error("[feedback] ❌ No shop available from auth or URL params");
        // Return error response instead of throwing (useFetcher doesn't handle redirects)
        return { success: false, error: "Authentication failed" };
      }
      shop = shopParam;
    }

    if (!shop) {
      console.error("[feedback] No shop in session or URL");
      return { success: false, error: "No shop found" };
    }

    console.log(`[feedback] POST received from shop: ${shop}`);

    const formData = await request.formData();
    const message = (formData.get("message") as string | null)?.trim() ?? "";
    const email = (formData.get("email") as string | null)?.trim() || null;

    console.log(`[feedback] Parsed form: message length=${message.length}, email=${email ? "yes" : "no"}`);

    // Validate message
    if (!message) {
      console.warn(`[feedback] Validation FAILED: empty message`);
      return { success: false, error: "Message is required" };
    }
    if (message.length > 5000) {
      console.warn(`[feedback] Validation FAILED: message too long (${message.length} chars)`);
      return { success: false, error: "Message is too long (max 5000 chars)" };
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

    // Return success response for useFetcher
    return { success: true, feedbackId: savedFeedback.id };
  } catch (err) {
    console.error(`[feedback] ❌ FAILURE in action:`, err);
    console.error(`[feedback] Error type: ${err instanceof Error ? err.constructor.name : typeof err}`);
    if (err instanceof Error) {
      console.error(`[feedback] Error message: ${err.message}`);
      console.error(`[feedback] Stack trace:\n${err.stack}`);
    }
    // Return error response for useFetcher
    const errorMsg = err instanceof Error ? err.message : "Failed to save feedback";
    return { success: false, error: errorMsg };
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
