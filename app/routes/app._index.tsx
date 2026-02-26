import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useRouteError, redirect } from "react-router";
import { useState, useEffect, useRef } from "react";
import AdminLayout from "~/components/admin/AdminLayout";
import { MessageSquare, ShieldCheck, Clock, TrendingUp, Zap, DollarSign, MessageCircle } from "lucide-react";
import KpiCard from "~/components/admin/KpiCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

const FREE_LIMIT = 50;
const REVIEW_URL = "https://apps.shopify.com/shopmate-ai/reviews/new";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function last7DayBoundaries(): Date[] {
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d);
  }
  return days;
}

// ─── Review trigger logic (merchant-only, runs in loader) ─────────────────────

function getReviewTrigger(
  settings: {
    hasReviewed: boolean;
    reviewDismissedCount: number;
    reviewRequestedAt: Date | null;
    aiHandledChats: number;
    orderTrackingResolved: number;
    createdAt: Date;
  },
  totalShopChats: number,
): string | false {
  // Don't-ask rules
  if (settings.hasReviewed) return false;
  if (settings.reviewDismissedCount >= 2) return false;

  // 30-day cooldown since last prompt
  if (settings.reviewRequestedAt) {
    const daysSince = (Date.now() - settings.reviewRequestedAt.getTime()) / 86_400_000;
    if (daysSince < 30) return false;
  }

  // Trigger 1: 3+ AI-handled chats
  if (settings.aiHandledChats >= 3) return "ai_handled";

  // Trigger 2: at least 1 order tracking query resolved
  if (settings.orderTrackingResolved >= 1) return "order_tracking";

  // Trigger 3: 7 days of install + 5 total chats
  const daysSinceInstall = (Date.now() - settings.createdAt.getTime()) / 86_400_000;
  if (daysSinceInstall >= 7 && totalShopChats >= 5) return "usage_milestone";

  return false;
}

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("[app._index action] REQUEST RECEIVED!", { method: request.method, url: request.url });

  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = (formData.get("intent") as string | null)?.trim();

  console.log("[app._index action] Received intent:", intent, "shop:", shop);

  // ─── Handle Review Banner intents ──
  if (intent === "review_completed" || intent === "review_dismissed") {
    console.log(`[app._index action] Review intent: ${intent} from ${shop}`);
    try {
      await prisma.shopSettings.update({
        where: { shop },
        data: {
          hasReviewed: intent === "review_completed",
          reviewDismissedCount: intent === "review_dismissed"
            ? { increment: 1 }
            : undefined,
        },
      });
      console.log(`[app._index action] ✅ Review intent processed`);
      return Response.json({ ok: true });
    } catch (err) {
      console.error("[app._index action] ❌ Review error:", err instanceof Error ? err.message : String(err));
      return Response.json({ ok: false }, { status: 500 });
    }
  }

  // ─── Handle Feedback submission ──
  if (intent === "feedback_submission") {
    console.log(`[app._index action] Feedback submission from ${shop}`);
    const message = (formData.get("message") as string | null)?.trim() ?? "";
    const email = (formData.get("email") as string | null)?.trim() || null;

    console.log(`[app._index action] Feedback: message length=${message.length}, email=${email ? "provided" : "empty"}`);

    // Validate
    if (!message) {
      console.log("[app._index action] Validation failed: no message");
      return redirect("/app?feedback=error");
    }
    if (message.length > 5000) {
      console.log("[app._index action] Validation failed: message too long");
      return redirect("/app?feedback=error");
    }

    try {
      // Fetch current plan from DB
      const settings = await prisma.shopSettings.findUnique({
        where: { shop },
        select: { plan: true },
      });
      const plan = settings?.plan ?? "free";

      // Save feedback to DB with explicit replied field
      const savedFeedback = await prisma.feedback.create({
        data: {
          shop,
          message,
          email: email || null,
          plan,
          replied: false,
        },
      });

      console.log(`[app._index action] ✅ Feedback saved with ID: ${savedFeedback.id}`);
      return redirect("/app?feedback=success");
    } catch (err) {
      console.error("[app._index action] ❌ Feedback error:", err instanceof Error ? err.message : String(err));
      return redirect("/app?feedback=error");
    }
  }

  // Unknown intent
  return Response.json({ ok: false, error: "Unknown intent" }, { status: 400 });
};

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  // Check for feedback success parameter from redirect
  const url = new URL(request.url);
  const feedbackSuccess = url.searchParams.has("feedback") && url.searchParams.get("feedback") === "success";

  // ── Billing check ──
  const { hasActivePayment } = await billing.check({
    plans: ["ShopMate Pro"],
    isTest: process.env.NODE_ENV !== "production",
  });

  // ── Sync plan to DB & update activity tracking ──
  const newPlan = hasActivePayment ? "pro" : "free";
  const settings = await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, plan: newPlan, lastActiveAt: new Date() },
    update: { plan: newPlan, lastActiveAt: new Date() },
  });

  // ── KPI totals ──
  const totalChats = await prisma.conversation.count({ where: { shop } });
  const totalMessages = await prisma.message.count({
    where: { conversation: { shop } },
  });

  // ── Per-day conversation counts (last 7 days) ──
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

  const recentConversations = await prisma.conversation.findMany({
    where: { shop, createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true },
  });

  const boundaries = last7DayBoundaries();
  const chatData = boundaries.map((dayStart) => {
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const count = recentConversations.filter(
      (c) => c.createdAt >= dayStart && c.createdAt < dayEnd,
    ).length;
    return { day: DAY_LABELS[dayStart.getUTCDay()], chats: count };
  });

  // ── Per-day message counts ──
  const recentMessages = await prisma.message.findMany({
    where: { conversation: { shop }, createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true },
  });

  const messageData = boundaries.map((dayStart) => {
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const count = recentMessages.filter(
      (m) => m.createdAt >= dayStart && m.createdAt < dayEnd,
    ).length;
    return { day: DAY_LABELS[dayStart.getUTCDay()], messages: count };
  });

  // ── Recent conversations list (last 10, newest first) ──
  const latestConversations = await prisma.conversation.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  });

  // ── Deflection rate ──
  const handledCount = await prisma.conversation.count({
    where: { shop, messages: { some: { role: "assistant" } } },
  });
  const deflectionRate =
    totalChats > 0 ? Math.round((handledCount / totalChats) * 100) : 0;

  // ── Avg messages per conversation ──
  const avgMessages =
    totalChats > 0 ? (totalMessages / totalChats).toFixed(1) : "0";

  // ── Revenue attribution KPIs ──
  // Total all-time attributed revenue for this shop
  const allTimeAttributions = await prisma.chatAttribution.findMany({
    where: { shop, attributedRevenue: { not: null } },
    select: { attributedRevenue: true, productTitle: true, productHandle: true, attributedAt: true },
  });

  const totalRevenue = allTimeAttributions.reduce(
    (sum, a) => sum + (a.attributedRevenue ?? 0), 0,
  );

  // This week's attributed revenue (last 7 days)
  const weekRevenue = allTimeAttributions
    .filter((a) => a.attributedAt && a.attributedAt >= sevenDaysAgo)
    .reduce((sum, a) => sum + (a.attributedRevenue ?? 0), 0);

  // Last week's attributed revenue (days 8-14 ago, for % change)
  const fourteenDaysAgo = new Date(sevenDaysAgo.getTime() - 7 * 86_400_000);
  const lastWeekRevenue = allTimeAttributions
    .filter(
      (a) => a.attributedAt && a.attributedAt >= fourteenDaysAgo && a.attributedAt < sevenDaysAgo,
    )
    .reduce((sum, a) => sum + (a.attributedRevenue ?? 0), 0);

  const revenueChangePct =
    lastWeekRevenue > 0
      ? Math.round(((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100)
      : weekRevenue > 0
      ? 100
      : 0;

  // ── Revenue leaderboard — top 5 products this week ──
  // Group this week's attributions by productHandle, sum revenue, count sales.
  const weekAttributions = allTimeAttributions.filter(
    (a) => a.attributedAt && a.attributedAt >= sevenDaysAgo,
  );
  const leaderMap = new Map<string, { title: string; handle: string; revenue: number; sales: number }>();
  for (const a of weekAttributions) {
    const key = a.productHandle || a.productTitle;
    if (!key) continue;
    const existing = leaderMap.get(key);
    if (existing) {
      existing.revenue += a.attributedRevenue ?? 0;
      existing.sales   += 1;
    } else {
      leaderMap.set(key, {
        title:   a.productTitle,
        handle:  a.productHandle,
        revenue: a.attributedRevenue ?? 0,
        sales:   1,
      });
    }
  }
  const revenueLeaderboard = [...leaderMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Review banner trigger check ──
  // Evaluated here so the merchant sees the banner on their next dashboard load
  // after enough chat activity has accumulated.
  const reviewTrigger = getReviewTrigger(
    {
      hasReviewed: settings.hasReviewed ?? false,
      reviewDismissedCount: settings.reviewDismissedCount ?? 0,
      reviewRequestedAt: settings.reviewRequestedAt ?? null,
      aiHandledChats: settings.aiHandledChats ?? 0,
      orderTrackingResolved: settings.orderTrackingResolved ?? 0,
      createdAt: settings.createdAt,
    },
    totalChats,
  );

  // If a trigger fires, stamp reviewRequestedAt so the 30-day cooldown starts now
  if (reviewTrigger) {
    await prisma.shopSettings.update({
      where: { shop },
      data: { reviewPrompted: true, reviewRequestedAt: new Date() },
    });
  }

  return {
    totalChats,
    totalMessages,
    deflectionRate,
    avgMessages,
    chatData,
    messageData,
    latestConversations: latestConversations.map((c) => ({
      id: c.id,
      shop: c.shop,
      messageCount: c._count.messages,
      firstMessage: c.messages[0]?.content ?? null,
      updatedAt: c.updatedAt.toISOString(),
    })),
    // Plan & usage
    plan: settings.plan as "free" | "pro",
    messageCount: settings.messageCount,
    freeLimit: FREE_LIMIT,
    // Review banner — only truthy when a trigger fires
    reviewTrigger: reviewTrigger as string | false,
    aiHandledChats: settings.aiHandledChats ?? 0,
    // Revenue attribution
    totalRevenue,
    weekRevenue,
    revenueChangePct,
    revenueLeaderboard,
    // Feedback success flag (from redirect after form submission)
    feedbackSuccess,
  };
};

// ─── Utility ──────────────────────────────────────────────────────────────────

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ─── Review Banner component ───────────────────────────────────────────────────

function ReviewBanner({
  trigger,
  aiHandledChats,
}: {
  trigger: string;
  aiHandledChats: number;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const headlineMap: Record<string, string> = {
    ai_handled: `🎉 Great job! ShopMate has handled ${aiHandledChats} customer chat${aiHandledChats !== 1 ? "s" : ""}!`,
    order_tracking: "📦 ShopMate just helped a customer track their order!",
    usage_milestone: "🚀 ShopMate has been running for a week — things are moving!",
  };

  const headline = headlineMap[trigger] ?? "🎉 ShopMate is working hard for your store!";

  function handleReview() {
    // Open review page in new tab
    window.open(REVIEW_URL, "_blank", "noopener,noreferrer");
    // Mark as reviewed in DB via form submission
    setIsSubmitting(true);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/app";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "intent";
    input.value = "review_completed";
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }

  function handleDismiss() {
    setIsSubmitting(true);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/app";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "intent";
    input.value = "review_dismissed";
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }

  // Hide banner while submitting
  if (isSubmitting) return null;

  return (
    <div
      style={{
        background: "hsl(160 100% 96%)",
        border: "1px solid #008060",
        borderRadius: 10,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap" as const,
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#004c3f" }}>
          {headline}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#006450" }}>
          Loving ShopMate? Help other merchants discover it by leaving a quick review — it only takes 30 seconds ⭐
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleReview}
          style={{
            padding: "7px 16px",
            borderRadius: 8,
            background: "#008060",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap" as const,
          }}
        >
          ⭐ Leave a Review
        </button>
        <button
          onClick={handleDismiss}
          style={{
            padding: "7px 12px",
            borderRadius: 8,
            background: "transparent",
            color: "#006450",
            fontSize: 13,
            border: "1px solid #008060",
            cursor: "pointer",
            whiteSpace: "nowrap" as const,
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

// ─── FeedbackModal component ──────────────────────────────────────────────────

function FeedbackModal({ onClose, feedbackSuccess }: { onClose: () => void; feedbackSuccess: boolean }) {
  const [message, setMessage] = useState("");
  const [email, setEmail]     = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Focus textarea when modal opens
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Show success toast if redirected back with success parameter
  useEffect(() => {
    if (feedbackSuccess) {
      console.log("[feedback-modal] Feedback success detected from redirect");
      // Brief success state before closing
      setTimeout(() => {
        setMessage("");
        setEmail("");
        onClose();
      }, 1500);
    }
  }, [feedbackSuccess, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Success toast notification — shown on redirect redirect */}
      {feedbackSuccess && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#059669",
            color: "#fff",
            padding: "14px 28px",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            zIndex: 10001,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            pointerEvents: "none",
            animation: "slideUp 0.3s ease-out",
          }}
        >
          ✓ Feedback sent — thank you!
        </div>
      )}

      {/* Backdrop */}
      <div
        role="button"
        tabIndex={-1}
        aria-label="Close feedback modal"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(); }}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 999998,
          pointerEvents: "auto",
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(520px, 92vw)",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
          zIndex: 999999,
          padding: "28px 28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          pointerEvents: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 id="feedback-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
              Send Feedback
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
              Help us improve ShopMate AI — your feedback goes directly to our team.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
              color: "#9ca3af",
              padding: "2px 4px",
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form - explicitly post to /app to reach the app._index route handler */}
        <form method="POST" action="/app" style={{ display: "flex", flexDirection: "column", gap: 20 }} ref={formRef}>
          {/* Hidden field to identify this as a feedback submission */}
          <input type="hidden" name="intent" value="feedback_submission" />
          {/* Message */}
          <div>
            <label
              htmlFor="feedback-message"
              style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 8 }}
            >
              Your feedback <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              id="feedback-message"
              name="message"
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              maxLength={5000}
              placeholder="What's working well? What could be better? Any features you'd love to see?"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 15,
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
                color: "#111827",
                background: "#fff",
                lineHeight: "1.5",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#008060";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 128, 96, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#d1d5db";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                Character count
              </p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: message.length > 4500 ? "#ef4444" : "#6b7280" }}>
                {message.length} / 5,000
              </p>
            </div>
          </div>

          {/* Email (optional) */}
          <div>
            <label
              htmlFor="feedback-email"
              style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 8 }}
            >
              Your email
              <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", marginLeft: 4 }}>(optional)</span>
            </label>
            <input
              id="feedback-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
                color: "#111827",
                background: "#fff",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#008060";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 128, 96, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#d1d5db";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#e5e7eb"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#f3f4f6"}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!message.trim()}
              onClick={(e) => {
                if (!message.trim()) {
                  e.preventDefault();
                  return;
                }
                console.log("[feedback-modal] Submit button clicked, form will submit normally");
              }}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                background: !message.trim() ? "#d1d5db" : "#008060",
                color: "#fff",
                border: "none",
                fontSize: 15,
                fontWeight: 600,
                cursor: !message.trim() ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                opacity: !message.trim() ? 0.7 : 1,
                zIndex: 1000000,
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (message.trim()) {
                  e.currentTarget.style.background = "#0a7255";
                }
              }}
              onMouseLeave={(e) => {
                if (message.trim()) {
                  e.currentTarget.style.background = "#008060";
                }
              }}
            >
              Send Feedback
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    totalChats,
    deflectionRate,
    avgMessages,
    chatData,
    messageData,
    latestConversations,
    plan,
    messageCount,
    freeLimit,
    reviewTrigger,
    aiHandledChats,
    totalRevenue,
    weekRevenue,
    revenueChangePct,
    revenueLeaderboard,
    feedbackSuccess,
  } = useLoaderData<typeof loader>();

  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const isPro = plan === "pro";

  // Navigate to /app/billing using a full-page navigation that preserves
  // Shopify's ?host= and other query params from the current URL.
  //
  // WHY NOT navigate("/app/billing"):
  //   React Router's navigate() triggers a client-side data fetch to
  //   /app/billing.data. That fetch carries no session token, so
  //   authenticate.admin() gets shop:null and returns 401.
  //
  // WHY window.location.href with preserved params:
  //   A full page load re-sends all the Shopify URL params (?host=, ?shop=,
  //   etc.) that authenticate.admin() needs to verify the session token.
  function goToBilling() {
    const current = new URL(window.location.href);
    current.pathname = "/app/billing";
    window.location.href = current.toString();
  }

  const usagePct = isPro ? 100 : Math.min(100, Math.round((messageCount / freeLimit) * 100));
  const usageColor = usagePct >= 90 ? "#b91c1c" : usagePct >= 70 ? "#d97706" : "#008060";

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">

      {/* ── Review banner — only visible when a trigger fires ── */}
      {reviewTrigger && (
        <ReviewBanner trigger={reviewTrigger} aiHandledChats={aiHandledChats} />
      )}

      {/* Plan banner */}
      <div
        style={{
          background: isPro ? "hsl(160 100% 96%)" : usagePct >= 90 ? "#fff7ed" : "hsl(210 10% 98%)",
          border: `1px solid ${isPro ? "#008060" : usagePct >= 90 ? "#f97316" : "hsl(210 10% 89%)"}`,
          borderRadius: 10,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap" as const,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={16} color={isPro ? "#008060" : "#6b7280"} />
          <span style={{ fontWeight: 600, fontSize: 14, color: isPro ? "#008060" : "#111827" }}>
            {isPro ? "ShopMate Pro — Unlimited messages" : `Free plan — ${messageCount} / ${freeLimit} messages used this month`}
          </span>
        </div>

        {!isPro && (
          <div style={{ flex: 1, minWidth: 160 }}>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: "hsl(210 10% 89%)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${usagePct}%`,
                  background: usageColor,
                  borderRadius: 999,
                  transition: "width .3s ease",
                }}
              />
            </div>
          </div>
        )}

        {!isPro && (
          <button
            onClick={goToBilling}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              background: "#008060",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap" as const,
            }}
          >
            Upgrade to Pro — $39/mo
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your ShopMate AI performance this week
          </p>
        </div>
        <button
          onClick={() => setFeedbackOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 16px",
            borderRadius: 8,
            background: "#f3f4f6",
            color: "#374151",
            border: "1px solid #d1d5db",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            whiteSpace: "nowrap" as const,
            flexShrink: 0,
          }}
        >
          <MessageCircle size={15} />
          Send Feedback
        </button>
      </div>

      {/* Feedback modal — rendered at root of the component so it overlays everything */}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} feedbackSuccess={feedbackSuccess} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Chats"
          value={String(totalChats)}
          change=""
          trend="up"
          icon={MessageSquare}
        />
        <KpiCard
          title="Deflection Rate"
          value={`${deflectionRate}%`}
          change=""
          trend="up"
          icon={ShieldCheck}
        />
        <KpiCard
          title="Avg Messages / Chat"
          value={avgMessages}
          change=""
          trend="up"
          icon={TrendingUp}
        />
        <KpiCard
          title="Conversations (7d)"
          value={String(chatData.reduce((s, d) => s + d.chats, 0))}
          change=""
          trend="up"
          icon={Clock}
        />
        <KpiCard
          title="Revenue from Chat"
          value={`$${weekRevenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          change={revenueChangePct !== 0 ? `${revenueChangePct > 0 ? "+" : ""}${revenueChangePct}% vs last week` : ""}
          trend={revenueChangePct >= 0 ? "up" : "down"}
          icon={DollarSign}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="polaris-card">
          <h3 className="polaris-card-header">Chat Volume (last 7 days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chatData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 10% 89%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(208 5% 45%)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(208 5% 45%)" }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(0 0% 100%)",
                  border: "1px solid hsl(210 10% 89%)",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="chats" fill="hsl(160 100% 25%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="polaris-card">
          <h3 className="polaris-card-header">Message Activity (last 7 days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={messageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 10% 89%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(208 5% 45%)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(208 5% 45%)" }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(0 0% 100%)",
                  border: "1px solid hsl(210 10% 89%)",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="messages"
                stroke="hsl(160 100% 25%)"
                strokeWidth={2}
                dot={{ fill: "hsl(160 100% 25%)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue Leaderboard + Recent Conversations side-by-side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* Revenue Leaderboard */}
      <div className="polaris-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="polaris-card-header" style={{ margin: 0 }}>🏆 Top Products via Chat</h3>
          <span style={{ fontSize: 11, color: "hsl(208 5% 45%)" }}>This week</span>
        </div>
        {revenueLeaderboard.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ fontSize: 13, color: "hsl(208 5% 45%)", margin: "0 0 6px" }}>
              No attributed revenue yet.
            </p>
            <p style={{ fontSize: 12, color: "hsl(208 5% 60%)", margin: 0 }}>
              Revenue appears here when customers buy products they clicked in chat.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {revenueLeaderboard.map((p, i) => (
              <div
                key={p.handle || p.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: i < revenueLeaderboard.length - 1 ? "1px solid hsl(210 10% 92%)" : "none",
                }}
              >
                {/* Rank badge */}
                <div
                  style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#cd7c2f" : "hsl(210 10% 89%)",
                    color: i < 3 ? "#fff" : "hsl(208 5% 45%)",
                    fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {i + 1}
                </div>
                {/* Product name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "hsl(208 5% 50%)" }}>
                    {p.sales} sale{p.sales !== 1 ? "s" : ""}
                  </p>
                </div>
                {/* Revenue */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#008060" }}>
                    ${p.revenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* All-time total */}
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid hsl(210 10% 89%)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: 12, color: "hsl(208 5% 50%)" }}>All-time attributed revenue</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#008060" }}>
            ${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="polaris-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="polaris-card-header" style={{ margin: 0 }}>Recent Conversations</h3>
          <button
            onClick={() => navigate("/app/conversations")}
            style={{
              fontSize: 12,
              color: "#008060",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
              textDecoration: "underline",
            }}
          >
            View all →
          </button>
        </div>
        {latestConversations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No conversations yet. The widget will appear here once customers start chatting.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {latestConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => navigate(`/app/conversations?id=${conv.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "10px 0",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid hsl(210 10% 92%)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                className="hover:bg-surface-hover"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground font-mono">
                    {conv.id.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground font-mono">
                      {conv.id.slice(0, 12)}…
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                      {conv.firstMessage
                        ? conv.firstMessage.slice(0, 60) + (conv.firstMessage.length > 60 ? "…" : "")
                        : "No messages"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="polaris-badge polaris-badge-info">
                    {conv.messageCount} msg{conv.messageCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(conv.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      </div>{/* end leaderboard + conversations grid */}
    </div>
    </AdminLayout>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
