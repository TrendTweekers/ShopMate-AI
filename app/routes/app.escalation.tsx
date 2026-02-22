import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // ── Update last active timestamp ──
  await prisma.shopSettings.upsert({
    where: { shop: session.shop },
    create: { shop: session.shop, lastActiveAt: new Date() },
    update: { lastActiveAt: new Date() },
  });

  return null;
};

export default function EscalationPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Escalation Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define how unresolved chats reach your support team
        </p>
      </div>

      <div className="polaris-card space-y-5">
        <h3 className="polaris-card-header">Trigger Rules</h3>
        {[
          {
            label: "Escalate after failed order lookup",
            desc: "When order can't be found after max retries",
            on: true,
          },
          {
            label: "Escalate on negative sentiment",
            desc: "Detect frustration or anger in messages",
            on: true,
          },
          {
            label: "Escalate on explicit request",
            desc: "Customer asks to speak with a human",
            on: true,
          },
          {
            label: "Escalate after inactivity",
            desc: "No bot response for 30+ seconds",
            on: false,
          },
        ].map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
            <Switch defaultChecked={r.on} />
          </div>
        ))}
      </div>

      <div className="polaris-card space-y-4">
        <h3 className="polaris-card-header">Contact Collection</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Collect email before escalating</p>
            <p className="text-xs text-muted-foreground">Ask customer for email if not already known</p>
          </div>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Collect issue summary</p>
            <p className="text-xs text-muted-foreground">Auto-generate a summary for support agents</p>
          </div>
          <Switch defaultChecked />
        </div>
      </div>

      <div className="polaris-card space-y-4">
        <h3 className="polaris-card-header">Forwarding</h3>
        <div>
          <label className="text-sm font-medium text-foreground">Support Email</label>
          <Input className="mt-1.5" defaultValue="support@yourstore.com" />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Escalation Message</label>
          <Input
            className="mt-1.5"
            defaultValue="I'm connecting you with our support team. They'll follow up via email shortly."
          />
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
