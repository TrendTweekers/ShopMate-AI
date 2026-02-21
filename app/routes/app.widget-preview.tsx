import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import ChatWidget from "~/components/storefront/ChatWidget";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { shop: session.shop };
};

export default function WidgetPreview() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Widget Preview</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Preview the storefront chat widget on a mobile device
        </p>
      </div>

      <div className="flex justify-center">
        {/* Phone frame */}
        <div className="relative w-[390px] h-[780px] bg-card rounded-[3rem] border-[8px] border-foreground/10 shadow-2xl overflow-hidden">
          {/* Status bar */}
          <div className="h-12 bg-card flex items-center justify-center">
            <div className="w-24 h-5 bg-foreground/10 rounded-full" />
          </div>

          {/* Mock storefront */}
          <div className="h-full bg-background relative overflow-hidden">
            {/* Fake store content */}
            <div className="p-4 space-y-4">
              <div className="h-6 w-32 bg-muted rounded" />
              <div className="h-48 bg-muted rounded-xl flex items-center justify-center">
                <span className="text-4xl">🛍️</span>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-4 w-36 bg-muted rounded" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 bg-muted rounded-xl" />
                ))}
              </div>
            </div>

            {/* Widget overlay */}
            <div className="absolute inset-0">
              <ChatWidget shop={shop} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
