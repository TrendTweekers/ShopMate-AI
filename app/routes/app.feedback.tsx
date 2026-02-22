/**
 * /app/feedback — action-only route
 *
 * Accepts a POST from the dashboard FeedbackModal:
 *   message  (required)
 *   email    (optional)
 *
 * 1. Saves feedback to the DB (Feedback table)
 * 2. Sends an email notification to admin@stackedboost.com
 * 3. Returns { ok: true } or { ok: false, error: string }
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";
import { sendEmail, buildFeedbackEmail } from "~/lib/email.server";
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

  // Fetch current plan from DB
  const settings = await prisma.shopSettings.findUnique({ where: { shop }, select: { plan: true } });
  const plan = settings?.plan ?? "free";

  const timestamp = new Date().toISOString();

  // 1. Save to DB
  await prisma.feedback.create({
    data: { shop, message, email, plan },
  });

  // 2. Send email (fire-and-forget — don't let email failure break the UX)
  sendEmail({
    to: "admin@stackedboost.com",
    subject: `[ShopMate Feedback] ${shop}`,
    html: buildFeedbackEmail({ shop, message, email, plan, timestamp }),
    replyTo: email ?? undefined,
  }).catch((err) => {
    console.error("[feedback] Email send failed:", err);
  });

  return Response.json({ ok: true });
};

// This route has no GET / no UI — return 405 for non-POST requests.
export const loader = async () => {
  return new Response("Method Not Allowed", { status: 405 });
};

export const headers = (headersArgs: Parameters<typeof boundary.headers>[0]) =>
  boundary.headers(headersArgs);

export function ErrorBoundary() {
  return boundary.error(new Error("Feedback route error"));
}
