import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Button } from "~/components/ui/button";
import { BookOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const defaultPolicies = [
  {
    id: 1,
    title: "Return Policy",
    content:
      "We accept returns within 30 days of purchase. Items must be unworn and in original packaging. Refunds are processed within 5-7 business days.",
    status: "active",
  },
  {
    id: 2,
    title: "Shipping Policy",
    content:
      "Free shipping on orders over $50. Standard delivery takes 3-5 business days. Express shipping available for $12.99.",
    status: "active",
  },
  {
    id: 3,
    title: "Size Guide",
    content:
      "Please refer to our detailed size chart for accurate measurements. When in doubt, size up. Our customer service team is happy to help with sizing questions.",
    status: "active",
  },
  {
    id: 4,
    title: "FAQ - Payment",
    content:
      "We accept Visa, Mastercard, AMEX, PayPal, and Shop Pay. All transactions are encrypted and secure.",
    status: "draft",
  },
];

export default function KnowledgePage() {
  const [policies] = useState(defaultPolicies);
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage policies and information your bot can reference
          </p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" /> Add Policy
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List */}
        <div className="space-y-2">
          {policies.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-full text-left p-4 rounded-lg border transition-colors ${
                selected === p.id
                  ? "bg-surface-selected border-primary"
                  : "bg-card border-border hover:bg-surface-hover"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">{p.title}</span>
                </div>
                <span
                  className={`polaris-badge ${
                    p.status === "active" ? "polaris-badge-success" : "polaris-badge-warning"
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.content}</p>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="polaris-card">
          {selected ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">
                  {policies.find((p) => p.id === selected)?.title}
                </h3>
                <div className="flex gap-1">
                  <button className="p-1.5 rounded-md hover:bg-surface-hover text-muted-foreground">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded-md hover:bg-surface-hover text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-foreground leading-relaxed">
                  {policies.find((p) => p.id === selected)?.content}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                The bot will use this content to answer related questions.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Select a policy to view details</p>
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
