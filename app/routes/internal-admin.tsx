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
  Menu,
  X,
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
  // If lastActiveAt is null (999 days) but store has chats, treat as green/yellow based on activity
  if (daysInactive === 999) {
    // Has chats but never logged in — fallback to yellow (setup in progress or merchant using widget)
    if (totalChats > 0) {
      return "yellow";
    }
    // No activity at all — red
    return "red";
  }

  // Red: inactive for >7 days
  if (daysInactive > 7) {
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
  return Math.min(100, Math.round((chats * 0.7) * 10));
}

// ─── Loader ───────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    throw new Response("Unauthorized", { status: 404 });
  }

  // Load shop settings with fallback
  let allSettings: any[] = [];
  try {
    allSettings = await prisma.shopSettings.findMany({
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
  } catch (err) {
    console.error("[internal-admin] Failed to load shop settings:", err);
  }

  // Load chat counts with fallback
  let chatCounts: any[] = [];
  try {
    chatCounts = await prisma.conversation.groupBy({
      by: ["shop"],
      _count: { id: true },
    });
  } catch (err) {
    console.error("[internal-admin] Failed to load chat counts:", err);
  }

  // Load feedback entries with fallback
  let feedbackEntries: any[] = [];
  try {
    feedbackEntries = await prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        shop: true,
        message: true,
        email: true,
        createdAt: true,
        replied: true,
      },
    });
  } catch (err) {
    console.error("[internal-admin] Failed to load feedback entries:", err);
  }

  console.log(`[internal-admin] Loaded ${feedbackEntries.length} feedback entries`);

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

  const feedback: FeedbackEntry[] = feedbackEntries.map((f) => ({
    id: f.id,
    shop: f.shop,
    message: f.message,
    email: f.email,
    createdAt: f.createdAt.toISOString(),
    replied: f.replied,
  }));

  return { stores, globalStats, feedback };
};

// ─── Action ───────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
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

    try {
      await prisma.shopSettings.update({
        where: { id: shopId },
        data: { internalNotes: notes || null },
      });
      return { success: true, type: "update-notes" };
    } catch (err) {
      console.error("[internal-admin] Failed to update notes:", err);
      return { success: false, type: "update-notes", error: String(err) };
    }
  }

  if (action === "toggle-widget") {
    const shopId = formData.get("shopId") as string;

    try {
      const current = await prisma.shopSettings.findUnique({
        where: { id: shopId },
        select: { widgetEnabled: true },
      });

      await prisma.shopSettings.update({
        where: { id: shopId },
        data: { widgetEnabled: !current?.widgetEnabled },
      });

      return { success: true, type: "toggle-widget", widgetEnabled: !current?.widgetEnabled };
    } catch (err) {
      console.error("[internal-admin] Failed to toggle widget:", err);
      return { success: false, type: "toggle-widget", error: String(err) };
    }
  }

  if (action === "extend-trial") {
    const shopId = formData.get("shopId") as string;

    try {
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
    } catch (err) {
      console.error("[internal-admin] Failed to extend trial:", err);
      return { success: false, type: "extend-trial", error: String(err) };
    }
  }

  if (action === "update-health") {
    const shopId = formData.get("shopId") as string;
    const healthScore = formData.get("healthScore") as "green" | "yellow" | "red";

    try {
      await prisma.shopSettings.update({
        where: { id: shopId },
        data: { healthScore },
      });

      return { success: true, type: "update-health" };
    } catch (err) {
      console.error("[internal-admin] Failed to update health score:", err);
      return { success: false, type: "update-health", error: String(err) };
    }
  }

  if (action === "toggle-replied") {
    const feedbackId = formData.get("feedbackId") as string;

    try {
      const current = await prisma.feedback.findUnique({
        where: { id: feedbackId },
        select: { replied: true },
      });

      await prisma.feedback.update({
        where: { id: feedbackId },
        data: { replied: !current?.replied },
      });

      return { success: true, type: "toggle-replied", replied: !current?.replied };
    } catch (err) {
      console.error("[internal-admin] Failed to toggle feedback replied:", err);
      return { success: false, type: "toggle-replied", error: String(err) };
    }
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 sticky top-0 z-20">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">ShopMate Admin</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Beta Program</p>
            </div>
            <div className="text-right ml-4">
              <div className="text-slate-400 text-xs">Stores</div>
              <div className="text-white font-semibold text-lg">{globalStats.totalStores}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-4">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Mobile: Stat Cards - Compact Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-6">
            <StatCard
              label="Stores"
              value={globalStats.totalStores}
              icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5" />}
              trend={null}
            />
            <StatCard
              label="Pro"
              value={globalStats.activePlans["pro"] || 0}
              icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />}
              trend={null}
            />
            <StatCard
              label="Chats"
              value={globalStats.totalChats}
              icon={<MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />}
              trend={null}
            />
            <StatCard
              label="Risk"
              value={globalStats.storesAtRisk}
              icon={<AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
              trend={`${Math.round((globalStats.storesAtRisk / globalStats.totalStores) * 100)}%`}
            />
            <StatCard
              label="Avg $"
              value={`$${globalStats.avgRevenuePerStore.toFixed(0)}`}
              icon={<DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />}
              trend={null}
            />
            <StatCard
              label="MRR"
              value={`$${Math.round(globalStats.totalMrr)}`}
              icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />}
              trend={null}
            />
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-slate-700">
            <div className="flex gap-4 sm:gap-6">
              <button
                onClick={() => {
                  setActiveTab("stores");
                  setMobileMenuOpen(false);
                }}
                className={`px-3 sm:px-4 py-3 font-medium text-sm sm:text-base border-b-2 transition whitespace-nowrap ${
                  activeTab === "stores"
                    ? "border-blue-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                Stores ({globalStats.totalStores})
              </button>
              <button
                onClick={() => {
                  setActiveTab("feedback");
                  setMobileMenuOpen(false);
                }}
                className={`px-3 sm:px-4 py-3 font-medium text-sm sm:text-base border-b-2 transition whitespace-nowrap ${
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
              {/* Mobile: Search & Sort */}
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 sm:p-4 mb-6 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search domain..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="activity">Sort: Activity</option>
                  <option value="domain">Sort: Domain</option>
                  <option value="plan">Sort: Plan</option>
                  <option value="health">Sort: Health</option>
                  <option value="revenue">Sort: Revenue</option>
                </select>
              </div>

              {/* Desktop: Table View, Mobile: Card View */}
              <div className="hidden sm:block bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <TableView stores={filteredStores} expandedStore={expandedStore} setExpandedStore={setExpandedStore} />
              </div>

              {/* Mobile: Card View */}
              <div className="sm:hidden space-y-3">
                {filteredStores.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">No stores found</div>
                ) : (
                  filteredStores.map((store) => (
                    <MobileStoreCard
                      key={store.id}
                      store={store}
                      expanded={expandedStore === store.id}
                      onToggle={() => setExpandedStore(expandedStore === store.id ? null : store.id)}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* Feedback Tab */}
          {activeTab === "feedback" && <FeedbackInbox entries={feedback} />}
        </div>
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
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 sm:p-4 hover:bg-slate-750 transition">
      <div className="flex items-start justify-between mb-2">
        <div className="text-slate-400 text-sm sm:text-base">{icon}</div>
        {trend && <span className="text-red-400 text-xs font-semibold">{trend}</span>}
      </div>
      <div className="text-lg sm:text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

function HealthBadge({ score }: { score: "green" | "yellow" | "red" }) {
  const config = {
    green: { bg: "bg-green-900", text: "text-green-300", icon: "✓" },
    yellow: { bg: "bg-yellow-900", text: "text-yellow-300", icon: "!" },
    red: { bg: "bg-red-900", text: "text-red-300", icon: "⚠" },
  };

  const { bg, text, icon } = config[score];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${bg} ${text}`}>
      <span>{icon}</span>
      {score}
    </span>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

interface TableViewProps {
  stores: StoreRow[];
  expandedStore: string | null;
  setExpandedStore: (id: string | null) => void;
}

function TableView({ stores, expandedStore, setExpandedStore }: TableViewProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-900 border-b border-slate-700">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Domain</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Plan</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Health</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Active</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Chats</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Revenue</th>
            <th className="px-4 py-3 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {stores.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                No stores found
              </td>
            </tr>
          ) : (
            stores.map((store) => (
              <React.Fragment key={store.id}>
                <tr
                  className="border-b border-slate-700 hover:bg-slate-700 transition cursor-pointer"
                  onClick={() => setExpandedStore(expandedStore === store.id ? null : store.id)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-white truncate max-w-xs">
                    {store.shop}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        store.plan === "pro"
                          ? "bg-blue-900 text-blue-300"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {store.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <HealthBadge score={store.healthScore} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {store.daysInactive === 999 ? (
                      <span className="text-slate-500 text-xs">Never</span>
                    ) : (
                      <div className="text-xs">
                        {formatTimeAgo(new Date(store.lastActiveAt!))}
                        <div className="text-slate-500">({store.daysInactive}d)</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{store.totalChats}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-400">
                    ${store.totalAiRevenue.toFixed(0)}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform ${expandedStore === store.id ? "rotate-180" : ""}`}
                    />
                  </td>
                </tr>

                {expandedStore === store.id && (
                  <tr className="bg-slate-750 border-b border-slate-700">
                    <td colSpan={7} className="px-4 py-4 sm:px-6 sm:py-6">
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
  );
}

interface MobileStoreCardProps {
  store: StoreRow;
  expanded: boolean;
  onToggle: () => void;
}

function MobileStoreCard({ store, expanded, onToggle }: MobileStoreCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-start justify-between hover:bg-slate-750 transition text-left"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm truncate">{store.shop}</h3>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              store.plan === "pro"
                ? "bg-blue-900 text-blue-300"
                : "bg-slate-700 text-slate-300"
            }`}>
              {store.plan}
            </span>
            <HealthBadge score={store.healthScore} />
            <span className="text-xs text-slate-400">
              {store.daysInactive === 999 ? "Never" : `${store.daysInactive}d`}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-300">
            <div><strong>{store.totalChats}</strong> chats</div>
            <div className="text-green-400"><strong>${store.totalAiRevenue.toFixed(0)}</strong></div>
          </div>
        </div>
        <ChevronDown
          size={20}
          className={`text-slate-400 flex-shrink-0 transition-transform ml-2 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          <StoreDetailPanel store={store} />
        </div>
      )}
    </div>
  );
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Metrics */}
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-white mb-3">Metrics</h3>
        <div className="space-y-2 bg-slate-900 rounded-lg p-3 border border-slate-700 text-sm">
          <MetricRow label="Chats" value={store.totalChats.toString()} />
          <MetricRow label="Revenue" value={`$${store.totalAiRevenue.toFixed(2)}`} highlight />
          <MetricRow label="Deflection" value={`${store.deflectionPercent}%`} />
          <MetricRow label="Inactive" value={store.daysInactive === 999 ? "Never" : `${store.daysInactive}d`} />
          {store.trialEndsAt && (
            <MetricRow label="Trial" value={new Date(store.trialEndsAt).toLocaleDateString()} />
          )}
        </div>
      </div>

      {/* Controls */}
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-white mb-3">Controls</h3>
        <div className="space-y-2">
          <button
            onClick={handleToggleWidget}
            className={`w-full px-3 py-2 rounded-lg font-medium text-sm transition ${
              store.widgetEnabled
                ? "bg-green-900 text-green-300 hover:bg-green-800"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {store.widgetEnabled ? "✓ Widget ON" : "✗ Widget OFF"}
          </button>

          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <label className="text-xs text-slate-400 mb-2 block">Health</label>
            <select
              value={selectedHealth}
              onChange={(e) => setSelectedHealth(e.target.value as any)}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 text-white rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                >
                  Apply
                </button>
              </fetcher.Form>
            )}
          </div>

          {store.plan === "free" && (
            <button
              onClick={handleExtendTrial}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm flex items-center justify-center gap-1"
            >
              <Zap size={14} />
              Extend +7d
            </button>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="sm:col-span-2 lg:col-span-1">
        <h3 className="text-sm sm:text-base font-semibold text-white mb-3">Notes</h3>
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSaveNotes}
            placeholder="Add notes..."
            className="w-full px-2 py-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs mb-2"
            rows={3}
          />
          <div className="text-xs text-slate-400">
            {isSaving ? "🔄 Saving..." : "✓ Auto-saves"}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${highlight ? "text-green-400" : "text-white"}`}>
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
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const sorted = [...entries].sort((a, b) => {
    if (sortBy === "recent") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const handleToggleReplied = async (feedbackId: string) => {
    setTogglingId(feedbackId);
    const formData = new FormData();
    formData.append("_action", "toggle-replied");
    formData.append("feedbackId", feedbackId);

    try {
      await fetch(`?password=${new URL(window.location.href).searchParams.get("password")}`, {
        method: "POST",
        body: formData,
      });
      // Optionally reload to reflect changes
      window.location.reload();
    } catch (error) {
      console.error("Failed to toggle replied status:", error);
      setTogglingId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
        <p className="text-slate-400 text-sm">{entries.length} total</p>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="recent">Recent</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 sm:p-8 text-center">
          <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No feedback yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((entry) => (
            <div
              key={entry.id}
              className={`bg-slate-800 rounded-lg border p-4 hover:border-slate-600 transition ${
                entry.replied ? "border-green-700 bg-opacity-50" : "border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white text-sm truncate">{entry.shop}</p>
                    {entry.replied && (
                      <span className="px-2 py-0.5 bg-green-900 text-green-300 text-xs font-medium rounded">
                        ✓ Replied
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    <Clock size={12} className="inline mr-1" />
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleReplied(entry.id)}
                    disabled={togglingId === entry.id}
                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                      entry.replied
                        ? "bg-green-900 text-green-300 hover:bg-green-800"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    } ${togglingId === entry.id ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {togglingId === entry.id ? "Updating..." : entry.replied ? "✓ Mark Unread" : "Mark Replied"}
                  </button>
                  {entry.email && (
                    <a
                      href={`mailto:${entry.email}`}
                      className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                    >
                      Reply
                    </a>
                  )}
                </div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed break-words">{entry.message}</p>
              {entry.email && (
                <p className="text-xs text-slate-500 mt-2 break-all">📧 {entry.email}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
