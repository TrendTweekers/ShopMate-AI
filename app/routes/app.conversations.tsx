import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Search, Filter, MessageSquare } from "lucide-react";
import { Input } from "~/components/ui/input";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const conversations = [
  {
    id: 1,
    customer: "Sarah Mitchell",
    email: "sarah@email.com",
    topic: "Order Tracking",
    status: "resolved",
    messages: 6,
    lastMessage: "Thanks! I can see it's arriving tomorrow.",
    time: "2 min ago",
    preview: [
      { role: "customer", text: "Hi, where's my order #2847?" },
      {
        role: "bot",
        text: "Let me look that up for you! I found order #2847. It's currently in transit and scheduled for delivery tomorrow by 5 PM.",
      },
      { role: "customer", text: "Thanks! I can see it's arriving tomorrow." },
    ],
  },
  {
    id: 2,
    customer: "James Kim",
    email: "james.k@email.com",
    topic: "Product Recommendation",
    status: "active",
    messages: 4,
    lastMessage: "What size should I get for the hoodie?",
    time: "5 min ago",
    preview: [
      { role: "customer", text: "I'm looking for a birthday gift for my girlfriend." },
      {
        role: "bot",
        text: "I'd love to help! What's her style like? Here are some popular picks...",
      },
      { role: "customer", text: "What size should I get for the hoodie?" },
    ],
  },
  {
    id: 3,
    customer: "Emma Lopez",
    email: "emma.l@email.com",
    topic: "Return Request",
    status: "escalated",
    messages: 8,
    lastMessage: "I want to speak to someone.",
    time: "12 min ago",
    preview: [
      { role: "customer", text: "I need to return my order, it's defective." },
      {
        role: "bot",
        text: "I'm sorry to hear that! I can help with returns. Could you share your order number?",
      },
      { role: "customer", text: "I want to speak to someone." },
    ],
  },
  {
    id: 4,
    customer: "Mike Roberts",
    email: "mike.r@email.com",
    topic: "Size Guide",
    status: "resolved",
    messages: 3,
    lastMessage: "Perfect, I'll go with the medium.",
    time: "18 min ago",
    preview: [
      { role: "customer", text: "What's the difference between M and L?" },
      {
        role: "bot",
        text: "Great question! Medium fits chest 38-40\" and Large fits 42-44\"...",
      },
      { role: "customer", text: "Perfect, I'll go with the medium." },
    ],
  },
  {
    id: 5,
    customer: "Lisa Park",
    email: "lisa.p@email.com",
    topic: "Shipping Inquiry",
    status: "resolved",
    messages: 4,
    lastMessage: "Got it, thank you!",
    time: "24 min ago",
    preview: [
      { role: "customer", text: "Do you ship to Canada?" },
      {
        role: "bot",
        text: "Yes! We ship to Canada. Standard shipping takes 7-10 business days and costs $14.99. Free shipping on orders over $100.",
      },
      { role: "customer", text: "Got it, thank you!" },
    ],
  },
];

export default function ConversationsPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const selectedConv = conversations.find((c) => c.id === selected);

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Conversations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {conversations.length} conversations this week
        </p>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search conversations..." className="pl-9" />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-md hover:bg-surface-hover transition-colors">
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* List */}
        <div className="lg:col-span-2 space-y-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selected === c.id
                  ? "bg-surface-selected border border-primary"
                  : "bg-card border border-border hover:bg-surface-hover"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground flex-shrink-0">
                    {c.customer
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.customer}</p>
                    <p className="text-xs text-muted-foreground">{c.topic}</p>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{c.time}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 truncate pl-9">{c.lastMessage}</p>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3 polaris-card min-h-[400px]">
          {selectedConv ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{selectedConv.customer}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedConv.email} · {selectedConv.topic}
                  </p>
                </div>
                <span
                  className={`polaris-badge ${
                    selectedConv.status === "resolved"
                      ? "polaris-badge-success"
                      : selectedConv.status === "active"
                      ? "polaris-badge-info"
                      : "polaris-badge-warning"
                  }`}
                >
                  {selectedConv.status}
                </span>
              </div>

              <div className="space-y-3">
                {selectedConv.preview.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "customer" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                        msg.role === "customer"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {selectedConv.messages} messages · Started {selectedConv.time}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Select a conversation to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
