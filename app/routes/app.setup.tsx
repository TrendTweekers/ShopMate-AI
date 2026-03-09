import { useState, useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import AdminLayout from "~/components/admin/AdminLayout";
import ChatWidget from "~/components/storefront/ChatWidget";
import { Check, ArrowRight, ArrowLeft, Bot, Sparkles } from "lucide-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

// ─── Loader ──────────────────────────────────────────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // ── Update last active timestamp & fetch current settings ──
  const settings = await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, lastActiveAt: new Date() },
    update: { lastActiveAt: new Date() },
  });

  const url = new URL(request.url);
  const success = url.searchParams.get("success") === "true";
  const error = url.searchParams.get("error");
  const host = url.searchParams.get("host") || "";

  return {
    shop,
    botName: settings.botName ?? "ShopMate",
    greeting: settings.greeting ?? "Hi! 👋 How can I help you today?",
    tone: (settings.tone ?? "Friendly").toLowerCase(),
    quickActions: settings.quickActions ?? ["Track order", "Product recommendations", "Returns & exchanges"],
    success,
    error,
    host,
  };
};

// ─── Steps ───────────────────────────────────────────────────────────────────
const steps = [
  { title: "Customize", description: "Name, greeting & tone", icon: Bot },
  { title: "Quick Actions", description: "Choose what appears first", icon: Sparkles },
  { title: "Done", description: "Ready to go!", icon: Check },
];

const toneOptions = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function SetupWizard() {
  const loaderData = useLoaderData<typeof loader>();
  const { host } = loaderData;
  const [currentStep, setCurrentStep] = useState(0);
  const [botName, setBotName] = useState(loaderData.botName);
  const [greeting, setGreeting] = useState(loaderData.greeting);
  const [tone, setTone] = useState(loaderData.tone);
  const [quickActions, setQuickActions] = useState(loaderData.quickActions);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shopify = useAppBridge();

  // ── Show success toast when returning from save ──
  useEffect(() => {
    if (loaderData.success) {
      shopify.toast.show("✅ Saved!", { duration: 2000 });
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      // Clear success param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      window.history.replaceState({}, "", url.toString());
    }
  }, [loaderData.success, shopify]);

  // ── Show error toast if something went wrong ──
  useEffect(() => {
    if (loaderData.error) {
      const errorMessages: Record<string, string> = {
        "save_failed": "Error saving settings. Please try again.",
        "no_actions": "Please select at least one quick action.",
        "invalid_method": "Invalid request.",
        "unknown_step": "Unknown step.",
      };
      shopify.toast.show(`❌ ${errorMessages[loaderData.error] || "Error"}`, { duration: 3000 });
      // Clear error param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [loaderData.error, shopify]);

  const handleQuickActionToggle = (action: string) => {
    if (quickActions.includes(action)) {
      setQuickActions(quickActions.filter((a) => a !== action));
    } else {
      setQuickActions([...quickActions, action]);
    }
  };

  const allQuickActions = [
    { label: "Track order", icon: "📦" },
    { label: "Product recommendations", icon: "✨" },
    { label: "Returns & exchanges", icon: "🔄" },
    { label: "Talk to human", icon: "👤" },
  ];

  return (
    <AdminLayout>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 20px" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 16, marginBottom: 20 }}>
          <img
            src="/assets/shopmatelogo.png"
            alt="ShopMate AI"
            style={{ height: 40, width: "auto", objectFit: "contain" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
          {/* Left: Wizard Form (65%) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
            <form
              method="POST"
              action="/app/setup/save"
              target="_top"
              className="polaris-card animate-fade-in"
              key={currentStep}
              onSubmit={() => setIsSubmitting(true)}
            >
              {/* Preserve Shopify host param */}
              <input type="hidden" name="host" value={host} />
              <input type="hidden" name="step" value={String(currentStep + 1)} />

              {/* Step 1: Customize */}
              {currentStep === 0 && (
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold text-foreground block mb-2">Bot Name</label>
                    <Input
                      name="botName"
                      value={botName}
                      onChange={(e) => setBotName(e.target.value)}
                      placeholder="ShopMate"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Customers will see this name in the chat header
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-foreground block mb-2">Greeting Message</label>
                    <Input
                      name="greeting"
                      value={greeting}
                      onChange={(e) => setGreeting(e.target.value)}
                      placeholder="Hi! 👋 How can I help you today?"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      First message customers see when they open the chat
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-foreground block mb-2">Tone</label>
                    <div className="flex gap-2">
                      {toneOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTone(opt.value)}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                            opt.value === tone
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:bg-surface-hover"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <input type="hidden" name="tone" value={tone.charAt(0).toUpperCase() + tone.slice(1)} />
                    <p className="text-xs text-muted-foreground mt-1">
                      This affects how the AI responds to customer questions
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Quick Actions */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select which quick action buttons to show on the home screen. At least one is required.
                  </p>
                  <div className="space-y-2">
                    {allQuickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handleQuickActionToggle(action.label)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                          quickActions.includes(action.label)
                            ? "bg-primary/10 border-primary"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={quickActions.includes(action.label)}
                          onChange={() => {}}
                          className="w-4 h-4"
                          aria-label={action.label}
                        />
                        <span className="text-lg">{action.icon}</span>
                        <span className="text-sm font-medium text-foreground">{action.label}</span>
                      </button>
                    ))}
                  </div>
                  {/* Hidden input for form submission */}
                  <input type="hidden" name="quickActions" value={JSON.stringify(quickActions)} />
                  {quickActions.length === 0 && (
                    <p className="text-xs text-destructive">
                      Please select at least one quick action
                    </p>
                  )}
                </div>
              )}

              {/* Step 3: Done */}
              {currentStep === 2 && (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8 text-accent-foreground" />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground">All Set! 🎉</h4>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    ShopMate is ready to go. Your chat widget is live on your storefront with the settings you configured.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can change these settings anytime from the dashboard.
                  </p>
                </div>
              )}
            </form>

            {/* Navigation */}
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0 || isSubmitting}
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  (currentStep === 0 && (!botName.trim() || !greeting.trim())) ||
                  (currentStep === 1 && quickActions.length === 0)
                }
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {currentStep === 2
                  ? isSubmitting
                    ? "Completing…"
                    : "Go to Dashboard"
                  : isSubmitting
                  ? "Saving…"
                  : "Next"}
                {currentStep < 2 && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Right: Live Widget Preview (35%) - Fixed Sidebar */}
          <div style={{ position: "sticky", top: 20, height: "fit-content" }}>
            <div className="polaris-card p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Live Preview</h4>
              {/* Phone frame */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "9 / 16",
                  backgroundColor: "hsl(0 0% 100%)",
                  borderRadius: "2rem",
                  border: "6px solid hsl(0 0% 5% / 0.1)",
                  boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Status bar */}
                <div
                  style={{
                    height: 24,
                    backgroundColor: "hsl(0 0% 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 12,
                      backgroundColor: "hsl(0 0% 5% / 0.1)",
                      borderRadius: 999,
                    }}
                  />
                </div>

                {/* Mock storefront */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: "hsl(0 0% 97%)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Fake store content */}
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12, marginBottom: 64 }}>
                    <div style={{ height: 16, width: 80, backgroundColor: "hsl(0 0% 92%)", borderRadius: 4 }} />
                    <div
                      style={{
                        height: 96,
                        backgroundColor: "hsl(0 0% 92%)",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                      }}
                    >
                      🛍️
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ height: 12, width: 128, backgroundColor: "hsl(0 0% 92%)", borderRadius: 2 }} />
                      <div style={{ height: 12, width: 96, backgroundColor: "hsl(0 0% 92%)", borderRadius: 2 }} />
                    </div>
                  </div>

                  {/* Widget overlay — docked at bottom */}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
                    <ChatWidget shop={loaderData.shop} />
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "hsl(0 0% 50%)", marginTop: 12, textAlign: "center" }}>
                This is how your widget looks on mobile
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
