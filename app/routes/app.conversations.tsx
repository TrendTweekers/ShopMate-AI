import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Search, Filter, MessageSquare } from "lucide-react";
import { Input } from "~/components/ui/input";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const conversations = await prisma.conversation.findMany({
    where: { shop: session.shop },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return { conversations };
};

export default function ConversationsPage() {
  const { conversations } = useLoaderData<typeof loader>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedConv = conversations.find((c) => c.id === selectedId);

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString();
  };

  const getInitials = (id: string) => id.slice(0, 2).toUpperCase();

  const lastMessage = (conv: (typeof conversations)[0]) =>
    conv.messages.length > 0
      ? conv.messages[conv.messages.length - 1].content
      : "No messages yet";

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Conversations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""} total
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
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedId === c.id
                    ? "bg-surface-selected border border-primary"
                    : "bg-card border border-border hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground flex-shrink-0">
                      {getInitials(c.id)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground font-mono">
                        {c.id.slice(0, 8)}…
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.messages.length} message{c.messages.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatTime(c.updatedAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 truncate pl-9">
                  {lastMessage(c)}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3 polaris-card min-h-[400px]">
          {selectedConv ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground font-mono">
                    {selectedConv.id}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedConv.shop} · {selectedConv.messages.length} messages
                  </p>
                </div>
                <span className="polaris-badge polaris-badge-info">
                  {selectedConv.messages.length > 0 ? "active" : "empty"}
                </span>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {selectedConv.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Started {formatTime(selectedConv.createdAt)} · Last updated{" "}
                  {formatTime(selectedConv.updatedAt)}
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
