import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Sparkles, TrendingUp, Shuffle, Clock } from "lucide-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const strategies = [
  { id: "bestsellers", title: "Best Sellers", desc: "Recommend top-selling products", icon: TrendingUp },
  { id: "personalized", title: "Personalized", desc: "Based on browsing and purchase history", icon: Sparkles },
  { id: "complementary", title: "Complementary", desc: "Items that pair well together", icon: Shuffle },
  { id: "new-arrivals", title: "New Arrivals", desc: "Recently added products", icon: Clock },
];

export default function RecommendationsPage() {
  const [activeStrategy, setActiveStrategy] = useState("personalized");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Recommendations</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure product recommendation engine</p>
      </div>

      <div className="polaris-card space-y-4">
        <h3 className="polaris-card-header">Strategy</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {strategies.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStrategy(s.id)}
              className={`flex items-start gap-3 text-left p-3 rounded-lg border transition-colors ${
                activeStrategy === s.id
                  ? "bg-surface-selected border-primary"
                  : "border-border hover:bg-surface-hover"
              }`}
            >
              <s.icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="polaris-card space-y-4">
        <h3 className="polaris-card-header">Stock Guardrails</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Hide out-of-stock products</p>
            <p className="text-xs text-muted-foreground">Never recommend unavailable items</p>
          </div>
          <Switch defaultChecked />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Min stock threshold</label>
          <Input type="number" defaultValue="5" className="mt-1.5 max-w-[120px]" />
          <p className="text-xs text-muted-foreground mt-1">Products below this stock level are excluded</p>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Max products per suggestion</label>
          <Input type="number" defaultValue="4" className="mt-1.5 max-w-[120px]" />
        </div>
      </div>

      <div className="polaris-card space-y-4">
        <h3 className="polaris-card-header">Exclusions</h3>
        <div>
          <label className="text-sm font-medium text-foreground">Excluded Collections</label>
          <Input className="mt-1.5" placeholder="e.g. Gift Cards, Internal" defaultValue="Gift Cards" />
          <p className="text-xs text-muted-foreground mt-1">Comma-separated collection names</p>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Excluded Tags</label>
          <Input className="mt-1.5" placeholder="e.g. hidden, draft" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
