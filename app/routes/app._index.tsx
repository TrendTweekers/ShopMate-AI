import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { MessageSquare, ShieldCheck, DollarSign, Clock } from "lucide-react";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const chatData = [
  { day: "Mon", chats: 42 },
  { day: "Tue", chats: 58 },
  { day: "Wed", chats: 65 },
  { day: "Thu", chats: 51 },
  { day: "Fri", chats: 73 },
  { day: "Sat", chats: 34 },
  { day: "Sun", chats: 28 },
];

const revenueData = [
  { day: "Mon", revenue: 320 },
  { day: "Tue", revenue: 480 },
  { day: "Wed", revenue: 520 },
  { day: "Thu", revenue: 410 },
  { day: "Fri", revenue: 680 },
  { day: "Sat", revenue: 290 },
  { day: "Sun", revenue: 210 },
];

const recentConversations = [
  { id: 1, customer: "Sarah M.", topic: "Order tracking", status: "resolved", time: "2m ago" },
  { id: 2, customer: "James K.", topic: "Product recommendation", status: "active", time: "5m ago" },
  { id: 3, customer: "Emma L.", topic: "Return request", status: "escalated", time: "12m ago" },
  { id: 4, customer: "Mike R.", topic: "Size guide help", status: "resolved", time: "18m ago" },
  { id: 5, customer: "Lisa P.", topic: "Shipping inquiry", status: "resolved", time: "24m ago" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">Your ShopMate AI performance this week</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Chats" value="351" change="+12.5%" trend="up" icon={MessageSquare} />
        <KpiCard title="Deflection Rate" value="78%" change="+3.2%" trend="up" icon={ShieldCheck} />
        <KpiCard title="Revenue from Recs" value="$2,910" change="+18.7%" trend="up" icon={DollarSign} />
        <KpiCard title="Avg Response Time" value="1.2s" change="-0.3s" trend="up" icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="polaris-card">
          <h3 className="polaris-card-header">Chat Volume</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chatData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 10% 89%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(208 5% 45%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(208 5% 45%)" }} />
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
          <h3 className="polaris-card-header">Revenue from Recommendations</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 10% 89%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(208 5% 45%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(208 5% 45%)" }} />
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
                dataKey="revenue"
                stroke="hsl(160 100% 25%)"
                strokeWidth={2}
                dot={{ fill: "hsl(160 100% 25%)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="polaris-card">
        <h3 className="polaris-card-header">Recent Conversations</h3>
        <div className="divide-y divide-border">
          {recentConversations.map((conv) => (
            <div key={conv.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                  {conv.customer.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{conv.customer}</p>
                  <p className="text-xs text-muted-foreground">{conv.topic}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`polaris-badge ${
                    conv.status === "resolved"
                      ? "polaris-badge-success"
                      : conv.status === "active"
                      ? "polaris-badge-info"
                      : "polaris-badge-warning"
                  }`}
                >
                  {conv.status}
                </span>
                <span className="text-xs text-muted-foreground">{conv.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
