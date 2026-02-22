import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useActionData, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import prisma from "~/db.server";
import {
  ChevronDown,
  Search,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Clock,
  DollarSign,
  Activity,
} from "lucide-react";
import React from "react";

// ─── Type Definitions ─────────────────────────────────────────────────────

interface StoreRow {
  id: string;
  shop: string;
  plan: string;
  healthScore: "green" | "yellow" | "red";
  widgetEnabled: boolean;
  lastActiveAt: string | null;
  totalChats: number;
  totalAiRevenue: number;
  internalNotes: string | null;
  trialEndsAt: string | null;
  deflectionPercent: number;
  createdAt: string;
  daysInactive: number;
}

interface GlobalStats {
  totalStores: number;
  activePlans: Record<string, number>;
  totalMrr: number;
  avgDeflection: number;
  storesAtRisk: number;
  avgRevenuePerStore: number;
  totalChats: number;
}

interface FeedbackEntry {
  id: string;
  shop: string;
  message: string;
  email: string | null;
  createdAt: string;
  replied: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function calculateDaysInactive(lastActiveAt: Date | null): number {
  if (!lastActiveAt) return 999;
  return Math.floor((Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24));
}

function calculateAutoHealthScore(daysInactive: number, totalChats: number): "green" | "yellow" | "red" {
  // Red: inactive for >7 days OR never had any chats
  if (daysInactive > 7 || (daysInactive === 999 && totalChats === 0)) {
    return "red";
  }

  // Yellow: inactive for 3-7 days
  if (daysInactive >= 3) {
    return "yellow";
  }

  // Green: active within last 3 days
  return "green";
}

function calculateDeflectionPercent(chats: number): number {
  if (chats === 0) return 0;
  // Base deflection: chats that handled customer inquiries without escalation
  return Math.min(100, Math.round((chats * 0.7) * 10)); // Rough estimate
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
      createdAt: true,
    },
  });

  // Get chat counts per shop
  const chatCounts = await prisma.conversation.groupBy({
    by: ["shop"],
    _count: { id: true },
  });

  // Fetch feedback entries
  const feedbackEntries = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shop: true,
      message: true,
      email: true,
      createdAt: true,
    },
  });

  // Build store rows with auto-calculated health
  const stores: StoreRow[] = allSettings.map((settings) => {
    const chatCount = chatCounts.find((c) => c.shop === settings.shop)?._count.id || 0;
    const daysInactive = calculateDaysInactive(settings.lastActiveAt);
    const autoHealthScore = calculateAutoHealthScore(daysInactive, chatCount);
    const deflectionPercent = calculateDeflectionPercent(chatCount);

    return {
      id: settings.id,
      shop: settings.shop,
      plan: settings.plan,
      healthScore: autoHealthScore,
      widgetEnabled: settings.widgetEnabled,
      lastActiveAt: settings.lastActiveAt?.toISOString() || null,
      totalChats: chatCount,
      totalAiRevenue: settings.totalAiRevenue,
      internalNotes: settings.internalNotes,
      trialEndsAt: settings.trialEndsAt?.toISOString() || null,
      deflectionPercent,
      createdAt: settings.createdAt.toISOString(),
      daysInactive,
    };
  });

  // Calculate global stats
  const totalChats = stores.reduce((sum, s) => sum + s.totalChats, 0);
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
      .reduce((sum, s) => sum + (s.totalAiRevenue / 12 || 0), 0),
    avgDeflection: stores.length
      ? Math.round(stores.reduce((sum, s) => sum + s.deflectionPercent, 0) / stores.length)
      : 0,
    storesAtRisk: stores.filter((s) => s.healthScore === "red").length,
    avgRevenuePerStore:
      stores.length > 0
        ? Math.round((stores.reduce((sum, s) => sum + s.totalAiRevenue, 0) / stores.length) * 100) / 100
        : 0,
    totalChats,
  };

  // Map feedback with replied status (for now, assume not replied)
  const feedback: FeedbackEntry[] = feedbackEntries.map((f) => ({
    id: f.id,
    shop: f.shop,
    message: f.message,
    email: f.email,
    createdAt: f.createdAt.toISOString(),
    replied: false, // TODO: track replied status in DB
  }));

  return { stores, globalStats, feedback };
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

    return { success: true, type: "update-notes" };
  }

  if (action === "toggle-widget") {
    const shopId = formData.get("shopId") as string;

    const current = await prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: { widgetEnabled: true },
    });

    await prisma.shopSettings.update({
      where: { id: shopId },
      data: { widgetEnabled: !current?.widgetEnabled },
    });

    return { success: true, type: "toggle-widget", widgetEnabled: !current?.widgetEnabled };
  }

  if (action === "extend-trial") {
    const shopId = formData.get("shopId") as string;

    const current = await prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: { trialEndsAt: true },
    });

    const newTrialEnd = current?.trialEndsAt ? new Date(current.trialEndsAt) : new Date();
    newTrialEnd.setDate(newTrialEnd.getDate() + 7);

    const updated = await prisma.shopSettings.update({
      where: { id: shopId },
      data: { trialEndsAt: newTrialEnd },
    });

    return {
      success: true,
      type: "extend-trial",
      newTrialEnd: updated.trialEndsAt?.toISOString(),
    };
  }

  if (action === "update-health") {
    const shopId = formData.get("shopId") as string;
    const healthScore = formData.get("healthScore") as "green" | "yellow" | "red";

    await prisma.shopSettings.update({
      where: { id: shopId },
      data: { healthScore },
    });

    return { success: true, type: "update-health" };
  }

  throw new Response("Unknown action", { status: 400 });
};

// ─── Component ────────────────────────────────────────────────────────────

export default function InternalAdminDashboard() {
  const { stores, globalStats, feedback } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"domain" | "plan" | "health" | "revenue" | "activity">(
    "activity",
  );
  const [activeTab, setActiveTab] = useState<"stores" | "feedback">("stores");

  const filteredStores = stores
    .filter((s) => s.shop.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "domain") return a.shop.localeCompare(b.shop);
      if (sortBy === "plan") return b.plan.localeCompare(a.plan);
      if (sortBy === "health") {
        const healthOrder = { red: 0, yellow: 1, green: 2 };
        return healthOrder[b.healthScore] - healthOrder[a.healthScore];
      }
      if (sortBy === "revenue") return b.totalAiRevenue - a.totalAiRevenue;
      if (sortBy === "activity") return a.daysInactive - b.daysInactive;
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">ShopMate Admin</h1>
              <p className="text-slate-400 text-sm mt-1">Beta Program Management</p>
            </div>
            <div className="text-right">
              <div className="text-slate-400 text-xs">Store Metrics</div>
              <div className="text-white font-semibold">{globalStats.totalStores} Active</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Global Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            label="Total Stores"
            value={globalStats.totalStores}
            icon={<Activity className="w-5 h-5" />}
            trend={null}
          />
          <StatCard
            label="Pro Plans"
            value={globalStats.activePlans["pro"] || 0}
            icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
            trend={null}
          />
          <StatCard
            label="Total Chats"
            value={globalStats.totalChats}
            icon={<MessageSquare className="w-5 h-5 text-green-400" />}
            trend={null}
          />
          <StatCard
            label="At Risk"
            value={globalStats.storesAtRisk}
            icon={<AlertCircle className="w-5 h-5 text-red-400" />}
            trend={`${Math.round((globalStats.storesAtRisk / globalStats.totalStores) * 100)}%`}
          />
          <StatCard
            label="Avg Revenue"
            value={`$${globalStats.avgRevenuePerStore.toFixed(0)}`}
            icon={<DollarSign className="w-5 h-5 text-green-400" />}
            trend={null}
          />
          <StatCard
            label="Monthly MRR"
            value={`$${Math.round(globalStats.totalMrr)}`}
            icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
            trend={null}
          />
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-slate-700">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("stores")}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === "stores"
                  ? "border-blue-500 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              Stores ({globalStats.totalStores})
            </button>
            <button
              onClick={() => setActiveTab("feedback")}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === "feedback"
                  ? "border-blue-500 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              Feedback ({feedback.length})
            </button>
          </div>
        </div>

        {/* Stores Tab */}
        {activeTab === "stores" && (
          <>
            {/* Search & Sort */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Search by domain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="activity">Sort: Activity</option>
                <option value="domain">Sort: Domain (A-Z)</option>
                <option value="plan">Sort: Plan</option>
                <option value="health">Sort: Health Status</option>
                <option value="revenue">Sort: Revenue</option>
              </select>
            </div>

            {/* Stores Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-700">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">
                        Domain
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">
                        Plan
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">
                        Health
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">
                        Last Active
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">
                        Chats
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">
                        Revenue
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">
                        Widget
                      </th>
                      <th className="px-6 py-4 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStores.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center">
                          <p className="text-slate-400">No stores found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredStores.map((store) => (
                        <React.Fragment key={store.id}>
                          <tr
                            className="border-b border-slate-700 hover:bg-slate-700 transition cursor-pointer"
                            onClick={() =>
                              setExpandedStore(expandedStore === store.id ? null : store.id)
                            }
                          >
                            <td className="px-6 py-4 text-sm font-medium text-white">
                              {store.shop}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  store.plan === "pro"
                                    ? "bg-blue-900 text-blue-300"
                                    : "bg-slate-700 text-slate-300"
                                }`}
                              >
                                {store.plan}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <HealthBadge score={store.healthScore} />
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-300">
                              {store.daysInactive === 999 ? (
                                <span className="text-slate-500">Never</span>
                              ) : (
                                <>
                                  {formatTimeAgo(new Date(store.lastActiveAt!))}
                                  <span className="text-slate-500 text-xs ml-1">
                                    ({store.daysInactive}d)
                                  </span>
                                </>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-white">
                              {store.totalChats}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-green-400">
                              ${store.totalAiRevenue.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded ${
                                  store.widgetEnabled
                                    ? "bg-green-900 text-green-300"
                                    : "bg-slate-700 text-slate-400"
                                }`}
                              >
                                {store.widgetEnabled ? "ON" : "OFF"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <ChevronDown
                                size={18}
                                className={`text-slate-400 transition-transform ${
                                  expandedStore === store.id ? "rotate-180" : ""
                                }`}
                              />
                            </td>
                          </tr>

                          {/* Expanded Row */}
                          {expandedStore === store.id && (
                            <tr className="bg-slate-750 border-b border-slate-700">
                              <td colSpan={8} className="px-6 py-6">
                                <StoreDetailPanel store={store} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Feedback Tab */}
        {activeTab === "feedback" && (
          <FeedbackInbox entries={feedback} />
        )}
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend: string | null;
}

function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:bg-slate-750 transition">
      <div className="flex items-start justify-between mb-3">
        <div className="text-slate-400">{icon}</div>
        {trend && <span className="text-red-400 text-sm font-semibold">{trend}</span>}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function HealthBadge({ score }: { score: "green" | "yellow" | "red" }) {
  const config = {
    green: {
      bg: "bg-green-900",
      text: "text-green-300",
      icon: "✓",
    },
    yellow: {
      bg: "bg-yellow-900",
      text: "text-yellow-300",
      icon: "!",
    },
    red: {
      bg: "bg-red-900",
      text: "text-red-300",
      icon: "⚠",
    },
  };

  const { bg, text, icon } = config[score];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      <span>{icon}</span>
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
  const [selectedHealth, setSelectedHealth] = useState<"green" | "yellow" | "red">(store.healthScore);
  const fetcher = useFetcher();

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

  const handleExtendTrial = async () => {
    const formData = new FormData();
    formData.append("_action", "extend-trial");
    formData.append("shopId", store.id);

    fetcher.submit(formData, { method: "POST" });
  };

  const handleToggleWidget = async () => {
    const formData = new FormData();
    formData.append("_action", "toggle-widget");
    formData.append("shopId", store.id);

    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Left: Metrics & Trial */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Store Metrics</h3>
        <div className="space-y-4 bg-slate-900 rounded-lg p-4 border border-slate-700">
          <MetricRow label="Total Chats" value={store.totalChats.toString()} />
          <MetricRow label="AI Revenue" value={`$${store.totalAiRevenue.toFixed(2)}`} highlight />
          <MetricRow label="Deflection Rate" value={`${store.deflectionPercent}%`} />
          <MetricRow label="Days Inactive" value={store.daysInactive === 999 ? "Never active" : `${store.daysInactive}d`} />
          {store.trialEndsAt && (
            <MetricRow
              label="Trial Expires"
              value={new Date(store.trialEndsAt).toLocaleDateString()}
            />
          )}
          <MetricRow label="Created" value={new Date(store.createdAt).toLocaleDateString()} />
        </div>
      </div>

      {/* Middle: Controls */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Admin Controls</h3>
        <div className="space-y-3">
          {/* Widget Toggle */}
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-300 mb-3">Widget Status</p>
            <button
              onClick={handleToggleWidget}
              className={`w-full px-4 py-2 rounded-lg font-medium transition text-sm ${
                store.widgetEnabled
                  ? "bg-green-900 text-green-300 hover:bg-green-800"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {store.widgetEnabled ? "✓ Widget: ON" : "✗ Widget: OFF"}
            </button>
          </div>

          {/* Health Override */}
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-300 mb-3">Health Override</p>
            <select
              value={selectedHealth}
              onChange={(e) => setSelectedHealth(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="green">🟢 Green</option>
              <option value="yellow">🟡 Yellow</option>
              <option value="red">🔴 Red</option>
            </select>
            {selectedHealth !== store.healthScore && (
              <fetcher.Form method="post" className="mt-2">
                <input type="hidden" name="_action" value="update-health" />
                <input type="hidden" name="shopId" value={store.id} />
                <input type="hidden" name="healthScore" value={selectedHealth} />
                <button
                  type="submit"
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  Apply Health Change
                </button>
              </fetcher.Form>
            )}
          </div>

          {/* Trial Extension */}
          {store.plan === "free" && (
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <p className="text-sm text-slate-300 mb-3">Trial Management</p>
              <button
                onClick={handleExtendTrial}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                Extend Trial +7d
              </button>
              {fetcher.data?.type === "extend-trial" && (
                <p className="text-xs text-green-400 mt-2">✓ Trial extended</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Notes */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Internal Notes</h3>
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSaveNotes}
            placeholder="Add private notes about this store..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-2"
            rows={6}
          />
          <div className="text-xs text-slate-400">
            {isSaving ? "🔄 Saving..." : "✓ Auto-saves on blur"}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`font-semibold text-sm ${highlight ? "text-green-400" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

interface FeedbackInboxProps {
  entries: FeedbackEntry[];
}

function FeedbackInbox({ entries }: FeedbackInboxProps) {
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");

  const sorted = [...entries].sort((a, b) => {
    if (sortBy === "recent") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <p className="text-slate-400">Total feedback submissions: {entries.length}</p>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="recent">Most Recent</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No feedback yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((entry) => (
            <div
              key={entry.id}
              className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-white text-sm">{entry.shop}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <Clock size={12} className="inline mr-1" />
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
                {entry.email && (
                  <a
                    href={`mailto:${entry.email}`}
                    className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                  >
                    Reply
                  </a>
                )}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{entry.message}</p>
              {entry.email && (
                <p className="text-xs text-slate-500 mt-3">📧 {entry.email}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
