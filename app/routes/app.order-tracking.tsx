import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { authenticate } from "../shopify.server";
import AdminLayout from "~/components/admin/AdminLayout";
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

export default function OrderTracking() {
  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Order Tracking</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure how customers look up their orders</p>
      </div>

      <div className="polaris-card space-y-5">
        <h3 className="polaris-card-header">Required Fields</h3>
        {[
          { field: "Order Number", desc: "e.g. #1001", enabled: true },
          { field: "Email Address", desc: "Customer email on file", enabled: true },
          { field: "Phone Number", desc: "Optional verification", enabled: false },
          { field: "Last Name", desc: "Additional verification", enabled: false },
        ].map((item) => (
          <div key={item.field} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{item.field}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch defaultChecked={item.enabled} />
          </div>
        ))}
      </div>

      <div className="polaris-card space-y-4">
        <h3 className="polaris-card-header">Fallback Rules</h3>
        <div>
          <label className="text-sm font-medium text-foreground">Max Lookup Attempts</label>
          <Input type="number" defaultValue="3" className="mt-1.5 max-w-[120px]" />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Fallback Message</label>
          <Input
            className="mt-1.5"
            defaultValue="Sorry, we couldn't find that order. Please check your details or contact support."
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Auto-escalate on failure</p>
            <p className="text-xs text-muted-foreground">Send to support after max attempts</p>
          </div>
          <Switch defaultChecked />
        </div>
      </div>

      <div className="polaris-card space-y-4">
        <h3 className="polaris-card-header">Status Display</h3>
        {["Order Confirmed", "Shipped", "Out for Delivery", "Delivered"].map((status) => (
          <div key={status} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{status}</span>
            <Switch defaultChecked />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
      </div>
    </div>
    </AdminLayout>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
