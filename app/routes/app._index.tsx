import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { MessageSquare, ShieldCheck, Clock, TrendingUp, Zap } from "lucide-react";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Returns an array of the last 7 day boundaries (start of each UTC day), oldest first */
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

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  // ── Billing check ──
  // hasActivePayment returns true if the shop has any active recurring charge.
  const { hasActivePayment } = await billing.check({
    plans: ["ShopMate Pro"],
    isTest: process.env.NODE_ENV !== "production",
  });

  // ── Sync plan to DB ──
  const newPlan = hasActivePayment ? "pro" : "free";
  const settings = await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, plan: newPlan },
    update: { plan: newPlan },
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

  // Bucket by day-of-week label
  const boundaries = last7DayBoundaries();
  const chatData = boundaries.map((dayStart) => {
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const count = recentConversations.filter(
      (c) => c.createdAt >= dayStart && c.createdAt < dayEnd,
    ).length;
    return { day: DAY_LABELS[dayStart.getUTCDay()], chats: count };
  });

  // ── Per-day message counts (proxy for engagement / activity) ──
  const recentMessages = await prisma.message.findMany({
    where: {
      conversation: { shop },
      createdAt: { gte: sevenDaysAgo },
    },
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

  // ── Deflection rate: conversations with ≥1 message but never marked
  //    escalated (we approximate as "all AI-handled" for now) ──
  const handledCount = await prisma.conversation.count({
    where: { shop, messages: { some: { role: "assistant" } } },
  });
  const deflectionRate =
    totalChats > 0 ? Math.round((handledCount / totalChats) * 100) : 0;

  // ── Avg messages per conversation (proxy for engagement) ──
  const avgMessages =
    totalChats > 0 ? (totalMessages / totalChats).toFixed(1) : "0";

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
    // Billing redirect URL — merchant clicks this to subscribe
    billingUrl: `/app/billing`,
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
    billingUrl,
  } = useLoaderData<typeof loader>();

  const isPro = plan === "pro";
  const usagePct = isPro ? 100 : Math.min(100, Math.round((messageCount / freeLimit) * 100));
  const usageColor = usagePct >= 90 ? "#b91c1c" : usagePct >= 70 ? "#d97706" : "#008060";

  return (
    <div className="space-y-6 max-w-6xl">
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
          <a
            href={billingUrl}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              background: "#008060",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap" as const,
            }}
          >
            Upgrade to Pro — $29/mo
          </a>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your ShopMate AI performance this week
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Recent Conversations */}
      <div className="polaris-card">
        <h3 className="polaris-card-header">Recent Conversations</h3>
        {latestConversations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No conversations yet. The widget will appear here once customers start chatting.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {latestConversations.map((conv) => (
              <div
                key={conv.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
