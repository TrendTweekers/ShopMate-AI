import { useState, useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import AdminLayout from "~/components/admin/AdminLayout";
import { Check, ArrowRight, ArrowLeft, Bot, Package, Sparkles, BookOpen, Zap } from "lucide-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

// ─── Loader ──────────────────────────────────────────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // ── Update last active timestamp ──
  await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, lastActiveAt: new Date() },
    update: { lastActiveAt: new Date() },
  });

  // Fetch active KB entries so step 3 of the wizard shows what was imported
  const kbEntries = await prisma.knowledgeBase.findMany({
    where: { shop, status: "active" },
    select: { title: true, type: true, source: true },
    orderBy: { createdAt: "asc" },
  });

  return { kbEntries };
};

// ─── Action ──────────────────────────────────────────────────────────────────
// The Activate button POSTs here.  We use it to persist the "activated" flag
// and return a success signal back to the client.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  // In the future: save ShopSettings.activated = true via Prisma here.
  // For now just acknowledge — the client will show the toast + redirect.
  console.log(`[ShopMate] Activated for shop: ${session.shop}`);
  return Response.json({ ok: true, shop: session.shop });
};

// ─── Steps ───────────────────────────────────────────────────────────────────
const steps = [
  { title: "Welcome", description: "Configure your AI assistant", icon: Bot },
  { title: "Order Tracking", description: "Set up order lookup", icon: Package },
  { title: "Recommendations", description: "Product suggestion engine", icon: Sparkles },
  { title: "Knowledge Base", description: "Store policies & FAQs", icon: BookOpen },
  { title: "Go Live", description: "Activate on your store", icon: Zap },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function SetupWizard() {
  const { kbEntries } = useLoaderData<typeof loader>();
  const [currentStep, setCurrentStep] = useState(0);
  const fetcher = useFetcher<{ ok: boolean }>();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const isActivating = fetcher.state !== "idle";
  const activationDone = fetcher.data?.ok === true;

  // When the fetcher settles with ok:true, show an App Bridge toast then
  // navigate to the dashboard using React Router (not shopify.navigate which
  // doesn't exist on ShopifyGlobal).
  useEffect(() => {
    if (activationDone && fetcher.state === "idle") {
      shopify.toast.show("ShopMate AI activated! 🎉", { duration: 4000 });
      const timer = setTimeout(() => navigate("/app"), 1500);
      return () => clearTimeout(timer);
    }
  }, [activationDone, fetcher.state, shopify, navigate]);

  const handleActivate = () => {
    fetcher.submit({}, { method: "POST", action: "/app/setup" });
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
      {/* Logo */}
      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 4 }}>
        <img
          src="/assets/shopmatelogo.png"
          alt="ShopMate AI"
          style={{ height: 40, width: "auto", objectFit: "contain" }}
        />
      </div>

      {/* Progress */}
      <div className="polaris-card">
        <div className="flex items-center justify-between">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors ${
                  i <= currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded transition-colors ${
                    i < currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <h3 className="text-base font-semibold text-foreground">{steps[currentStep].title}</h3>
          <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
        </div>
      </div>

      {/* Step Content */}
      <div className="polaris-card animate-fade-in" key={currentStep}>
        {currentStep === 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Bot Name</h4>
            <Input placeholder="ShopMate" defaultValue="ShopMate" />
            <h4 className="text-sm font-semibold text-foreground">Greeting Message</h4>
            <Input
              placeholder="Hi! How can I help you today?"
              defaultValue="Hi! 👋 How can I help you today?"
            />
            <h4 className="text-sm font-semibold text-foreground">Tone</h4>
            <div className="flex gap-2">
              {["Friendly", "Professional", "Casual"].map((t) => (
                <button
                  key={t}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    t === "Friendly"
                      ? "bg-surface-selected border-primary text-accent-foreground"
                      : "border-border text-muted-foreground hover:bg-surface-hover"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Required Fields</h4>
            <div className="space-y-3">
              {["Order Number", "Email Address", "Phone Number"].map((field, i) => (
                <div key={field} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{field}</span>
                  <Switch defaultChecked={i < 2} />
                </div>
              ))}
            </div>
            <h4 className="text-sm font-semibold text-foreground">Fallback Message</h4>
            <Input
              placeholder="We couldn't find your order..."
              defaultValue="We couldn't find your order. Please double-check your details or contact support."
            />
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Strategy</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: "Best Sellers", desc: "Recommend top-selling products" },
                { title: "Personalized", desc: "Based on browsing history" },
                { title: "Complementary", desc: "Products that go well together" },
                { title: "New Arrivals", desc: "Latest products in store" },
              ].map((s, i) => (
                <button
                  key={s.title}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    i === 1
                      ? "bg-surface-selected border-primary"
                      : "border-border hover:bg-surface-hover"
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Hide out-of-stock items</span>
              <Switch defaultChecked />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Knowledge Base</h4>

            {kbEntries.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  ✓ {kbEntries.length} polic{kbEntries.length === 1 ? "y was" : "ies were"} automatically imported from your Shopify store.
                  The AI will use these to answer customer questions.
                </p>
                <div className="space-y-2">
                  {kbEntries.map((entry) => (
                    <div
                      key={entry.type}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{entry.title}</span>
                      </div>
                      <span className="polaris-badge polaris-badge-success">
                        {entry.source === "shopify_import" ? "Auto-imported" : "Manual"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  You can edit or add more entries in the Knowledge Base page.
                </p>
              </>
            ) : (
              <div
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "14px 16px", borderRadius: 10,
                  background: "#f0fdf4", border: "1px solid #86efac",
                }}
              >
                <BookOpen size={18} color="#15803d" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#15803d" }}>
                    You're almost there!
                  </p>
                  <p style={{ margin: "5px 0 0", fontSize: 12, color: "#166534", lineHeight: 1.6 }}>
                    Policies haven't been imported yet — that's totally fine at this stage.
                    Once you finish setup, head to the{" "}
                    <strong>Knowledge Base</strong> page to pull in your store's policies in one click.
                    You can also add custom FAQs and answers any time.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto">
              <Zap className="w-8 h-8 text-accent-foreground" />
            </div>
            <h4 className="text-lg font-semibold text-foreground">Ready to Go Live!</h4>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your ShopMate AI assistant is configured and ready. Click "Activate" to add the chat
              widget to your storefront.
            </p>
            <Button
              onClick={handleActivate}
              disabled={isActivating || activationDone}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
            >
              {isActivating
                ? "Activating…"
                : activationDone
                ? "Activated ✓"
                : "Activate ShopMate AI"}
            </Button>
          </div>
        )}
      </div>

      {/* Navigation */}
      {currentStep < 4 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button
            onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
    </AdminLayout>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
