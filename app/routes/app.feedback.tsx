/**
 * /app/feedback — Feedback submission action
 *
 * Accepts a POST from the dashboard FeedbackModal:
 *   message  (required, max 5000 chars)
 *   email    (optional)
 *
 * Saves feedback to the DB (Feedback table).
 * Email notification is optional (no dependency on mail server).
 * Returns { ok: true } or { ok: false, error: string }
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const message = (formData.get("message") as string | null)?.trim() ?? "";
  const email   = (formData.get("email")   as string | null)?.trim() || null;

  // Validate
  if (!message) {
    return Response.json({ ok: false, error: "Message is required." }, { status: 400 });
  }
  if (message.length > 5000) {
    return Response.json({ ok: false, error: "Message is too long (max 5,000 characters)." }, { status: 400 });
  }

  try {
    // Fetch current plan from DB
    const settings = await prisma.shopSettings.findUnique({
      where: { shop },
      select: { plan: true },
    });
    const plan = settings?.plan ?? "free";

    // Save feedback to DB
    await prisma.feedback.create({
      data: { shop, message, email, plan },
    });

    console.log(`[feedback] Feedback saved from shop: ${shop}`);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[feedback] Failed to save feedback:", err);
    return Response.json(
      { ok: false, error: "Failed to save feedback. Please try again." },
      { status: 500 }
    );
  }
};

// This route has no GET / no UI — return 405 for non-POST requests.
export const loader = async () => {
  return new Response("Method Not Allowed", { status: 405 });
};

export const headers = (headersArgs: Parameters<typeof boundary.headers>[0]) =>
  boundary.headers(headersArgs);
