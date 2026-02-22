import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useActionData } from "react-router";
import { useState } from "react";
import prisma from "~/db.server";
import { ChevronDown, Search, Zap } from "lucide-react";

// ─── Type Definitions ─────────────────────────────────────────────────────

interface StoreRow {
  id: string;
  shop: string;
  plan: string;
  healthScore: string;
  widgetEnabled: boolean;
  lastActiveAt: string | null;
  totalChats: number;
  totalAiRevenue: number;
  internalNotes: string | null;
  trialEndsAt: string | null;
  deflectionPercent: number;
}

interface GlobalStats {
  totalStores: number;
  activePlans: Record<string, number>;
  totalMrr: number;
  avgDeflection: number;
  storesAtRisk: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function calculateHealthScore(stats: {
  lastActiveAt?: Date | null;
  plan: string;
  totalChats: number;
}): "green" | "yellow" | "red" {
  const daysSinceActive = stats.lastActiveAt
    ? Math.floor((Date.now() - stats.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Red: inactive for 30+ days, or free plan with no chats
  if (daysSinceActive >= 30 || (stats.plan === "free" && stats.totalChats === 0)) {
    return "red";
  }

  // Yellow: inactive for 7+ days
  if (daysSinceActive >= 7) {
    return "yellow";
  }

  // Green: active within last 7 days
  return "green";
}

function calculateDeflectionPercent(chats: number, messages: number): number {
  if (chats === 0) return 0;
  // Rough estimate: deflection = (messages / chats) / 10, capped at 100%
  return Math.min(100, Math.round((messages / chats / 10) * 100));
}

// ─── Loader ───────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Password protection
  const url = new URL(request.url);
  const password = url.searchParams.get("password");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    throw new Response("Unauthorized", { status: 404 });
  }

  // Fetch all shops with stats
  const allSettings = await prisma.shopSettings.findMany({
    select: {
      id: true,
      shop: true,
      plan: true,
      healthScore: true,
      widgetEnabled: true,
      lastActiveAt: true,
      totalAiRevenue: true,
      internalNotes: true,
      trialEndsAt: true,
    },
  });

  // Get chat counts per shop
  const chatCounts = await prisma.conversation.groupBy({
    by: ["shop"],
    _count: { id: true },
  });

  const messageCounts = await prisma.message.groupBy({
    by: ["conversation"],
  });

  // Build store rows
  const stores: StoreRow[] = allSettings.map((settings) => {
    const chatCount = chatCounts.find((c) => c.shop === settings.shop)?._count.id || 0;
    const deflectionPercent = calculateDeflectionPercent(chatCount, 0); // TODO: calculate properly

    return {
      id: settings.id,
      shop: settings.shop,
      plan: settings.plan,
      healthScore: settings.healthScore,
      widgetEnabled: settings.widgetEnabled,
      lastActiveAt: settings.lastActiveAt?.toISOString() || null,
      totalChats: chatCount,
      totalAiRevenue: settings.totalAiRevenue,
      internalNotes: settings.internalNotes,
      trialEndsAt: settings.trialEndsAt?.toISOString() || null,
      deflectionPercent,
    };
  });

  // Calculate global stats
  const globalStats: GlobalStats = {
    totalStores: stores.length,
    activePlans: stores.reduce(
      (acc, s) => {
        acc[s.plan] = (acc[s.plan] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    totalMrr: stores
      .filter((s) => s.plan === "pro")
      .reduce((sum, s) => sum + (s.totalAiRevenue / 12 || 0), 0), // rough MRR
    avgDeflection: stores.length
      ? Math.round(stores.reduce((sum, s) => sum + s.deflectionPercent, 0) / stores.length)
      : 0,
    storesAtRisk: stores.filter((s) => s.healthScore === "red").length,
  };

  return { stores, globalStats };
};

// ─── Action ───────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  // Password check
  const url = new URL(request.url);
  const password = url.searchParams.get("password");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    throw new Response("Unauthorized", { status: 404 });
  }

  if (request.method !== "POST") {
    throw new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "update-notes") {
    const shopId = formData.get("shopId") as string;
    const notes = formData.get("notes") as string;

    await prisma.shopSettings.update({
      where: { id: shopId },
      data: { internalNotes: notes || null },
    });

    return { success: true };
  }

  if (action === "toggle-widget") {
    const shopId = formData.get("shopId") as string;
    const enabled = formData.get("enabled") === "true";

    await prisma.shopSettings.update({
      where: { id: shopId },
      data: { widgetEnabled: !enabled },
    });

    return { success: true };
  }

  if (action === "extend-trial") {
    const shopId = formData.get("shopId") as string;
    const newTrialEnd = new Date();
    newTrialEnd.setDate(newTrialEnd.getDate() + 7);

    await prisma.shopSettings.update({
      where: { id: shopId },
      data: { trialEndsAt: newTrialEnd },
    });

    return { success: true };
  }

  if (action === "update-health") {
    const shopId = formData.get("shopId") as string;
    const healthScore = formData.get("healthScore") as "green" | "yellow" | "red";

    await prisma.shopSettings.update({
      where: { id: shopId },
      data: { healthScore },
    });

    return { success: true };
  }

  throw new Response("Unknown action", { status: 400 });
};

// ─── Component ────────────────────────────────────────────────────────────

export default function InternalAdminDashboard() {
  const { stores, globalStats } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"domain" | "plan" | "health" | "revenue">("domain");

  const filteredStores = stores
    .filter((s) => s.shop.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "domain") return a.shop.localeCompare(b.shop);
      if (sortBy === "plan") return a.plan.localeCompare(b.plan);
      if (sortBy === "health") return b.healthScore.localeCompare(a.healthScore);
      if (sortBy === "revenue") return b.totalAiRevenue - a.totalAiRevenue;
      return 0;
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Internal Admin Dashboard</h1>
          <p className="text-slate-600">Founder-only view. Store performance, metrics, and tools.</p>
        </div>

        {/* Global Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Stores"
            value={globalStats.totalStores.toString()}
            icon="📊"
          />
          <StatCard
            label="Active (Pro)"
            value={globalStats.activePlans["pro"]?.toString() || "0"}
            icon="🟢"
          />
          <StatCard
            label="Avg Deflection"
            value={`${globalStats.avgDeflection}%`}
            icon="📈"
          />
          <StatCard
            label="At Risk"
            value={globalStats.storesAtRisk.toString()}
            icon="⚠️"
          />
        </div>

        {/* Search & Sort */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex gap-4 items-center">
          <Search className="text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="domain">Sort: Domain</option>
            <option value="plan">Sort: Plan</option>
            <option value="health">Sort: Health</option>
            <option value="revenue">Sort: Revenue</option>
          </select>
        </div>

        {/* Stores Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Domain</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Plan</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Health</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Active</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Chats</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Revenue</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700"></th>
              </tr>
            </thead>
            <tbody>
              {filteredStores.map((store) => (
                <React.Fragment key={store.id}>
                  <tr
                    className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition"
                    onClick={() =>
                      setExpandedStore(expandedStore === store.id ? null : store.id)
                    }
                  >
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{store.shop}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          store.plan === "pro"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {store.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <HealthBadge score={store.healthScore} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {store.lastActiveAt
                        ? formatTimeAgo(new Date(store.lastActiveAt))
                        : "Never"}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {store.totalChats}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">
                      ${store.totalAiRevenue.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <ChevronDown
                        size={18}
                        className={`transition-transform ${expandedStore === store.id ? "rotate-180" : ""}`}
                      />
                    </td>
                  </tr>

                  {/* Expanded Row */}
                  {expandedStore === store.id && (
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <td colSpan={7} className="px-6 py-6">
                        <StoreDetailPanel store={store} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Feedback Inbox Section */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Feedback Inbox</h2>
          <p className="text-slate-600 text-sm">
            Recent merchant feedback submissions will appear here. (Requires Feedback table
            populated)
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-600 mt-1">{label}</div>
    </div>
  );
}

function HealthBadge({ score }: { score: string }) {
  const colors = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[score as keyof typeof colors]}`}>
      {score}
    </span>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

interface StoreDetailPanelProps {
  store: StoreRow;
}

function StoreDetailPanel({ store }: StoreDetailPanelProps) {
  const [notes, setNotes] = useState(store.internalNotes || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveNotes = async () => {
    setIsSaving(true);
    const formData = new FormData();
    formData.append("_action", "update-notes");
    formData.append("shopId", store.id);
    formData.append("notes", notes);

    await fetch(`?password=${new URL(window.location.href).searchParams.get("password")}`, {
      method: "POST",
      body: formData,
    });

    setIsSaving(false);
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: Stats */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">Store Metrics</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Total Chats:</span>
            <span className="font-semibold">{store.totalChats}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">AI Revenue:</span>
            <span className="font-semibold text-green-600">${store.totalAiRevenue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Deflection Rate:</span>
            <span className="font-semibold">{store.deflectionPercent}%</span>
          </div>
          {store.trialEndsAt && (
            <div className="flex justify-between">
              <span className="text-slate-600">Trial Ends:</span>
              <span className="font-semibold">{new Date(store.trialEndsAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions & Notes */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">Admin Controls</h3>
        <div className="space-y-3">
          <Form method="post" className="flex gap-2">
            <input type="hidden" name="_action" value="toggle-widget" />
            <input type="hidden" name="shopId" value={store.id} />
            <input type="hidden" name="enabled" value={store.widgetEnabled.toString()} />
            <button
              type="submit"
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
                store.widgetEnabled
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {store.widgetEnabled ? "Widget: ON" : "Widget: OFF"}
            </button>
          </Form>

          {store.plan === "free" && (
            <Form method="post">
              <input type="hidden" name="_action" value="extend-trial" />
              <input type="hidden" name="shopId" value={store.id} />
              <button
                type="submit"
                className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                Extend Trial +7d
              </button>
            </Form>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="col-span-2 border-t border-slate-200 pt-4">
        <label className="block text-sm font-semibold text-slate-900 mb-2">Internal Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleSaveNotes}
          placeholder="Add private notes about this store..."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          rows={3}
        />
        <div className="text-xs text-slate-500 mt-1">
          {isSaving ? "Saving..." : "Auto-saves on blur"}
        </div>
      </div>
    </div>
  );
}

// Add React import for Fragment
import React from "react";
