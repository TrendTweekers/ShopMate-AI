import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, redirect, useFetcher } from "react-router";
import AdminLayout from "~/components/admin/AdminLayout";
import ChatWidget from "~/components/storefront/ChatWidget";
import { Check, ArrowRight, ArrowLeft, Bot, Sparkles } from "lucide-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Input } from "~/components/ui/input";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

// ─── Action (single POST on final Finish) ────────────────────────────────────
export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("[app.setup] action START");

  const formData = await request.formData();
  const host = (formData.get("host") as string) || "";

  let shop: string = "";

  try {
    const { session } = await authenticate.admin(request);
    shop = session.shop;
    console.log("[app.setup] action auth: session →", shop);
  } catch {
    // Fallback: decode host param
    if (host) {
      try {
        const decoded = Buffer.from(host, "base64").toString("utf-8");
        if (decoded.includes("admin.shopify.com/store/")) {
          shop = `${decoded.split("admin.shopify.com/store/")[1]}.myshopify.com`;
        } else {
          shop = host;
        }
      } catch {
        shop = host;
      }
      console.log("[app.setup] action auth: host fallback →", shop);
    }
  }

  if (!shop) {
    console.error("[app.setup] action: no shop — redirecting to login");
    return redirect("/auth/login");
  }

  const botName   = ((formData.get("botName")   as string) || "ShopMate").trim();
  const greeting  = ((formData.get("greeting")  as string) || "Hi! 👋 How can I help you today?").trim();
  const tone      = ((formData.get("tone")      as string) || "Friendly").trim();
  const quickActionsRaw = (formData.get("quickActions") as string) || "[]";

  let quickActions: string[] = [];
  try { quickActions = JSON.parse(quickActionsRaw); } catch { quickActions = []; }

  console.log("[app.setup] action saving:", { shop, botName, tone, quickActions });

  await prisma.shopSettings.upsert({
    where:  { shop },
    update: { botName, greeting, tone, quickActions, setupCompleted: true, lastActiveAt: new Date() },
    create: { shop, botName, greeting, tone, quickActions, setupCompleted: true, lastActiveAt: new Date() },
  });

  console.log("[app.setup] action ✅ saved — returning success");

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// ─── Loader ──────────────────────────────────────────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url        = new URL(request.url);
  const hostParam  = url.searchParams.get("host") || "";
  const idTokenParam = url.searchParams.get("id_token") || "";
  const error      = url.searchParams.get("error");

  console.log("[app.setup] loader START", { host: !!hostParam, idToken: !!idTokenParam });

  let shop: string = "";
  let authSource   = "none";

  const hasAuthToken = url.searchParams.has("id_token");
  const hasCookie    = request.headers.get("cookie")?.includes("shopify.app.session");

  if (hasAuthToken || (hasCookie && !hostParam)) {
    try {
      const { session } = await authenticate.admin(request);
      shop       = session.shop;
      authSource = "admin_auth";
      console.log("[app.setup] loader auth →", shop);
    } catch {
      console.log("[app.setup] loader auth failed, trying fallback");
    }
  }

  if (!shop && hostParam) {
    try {
      const decoded = Buffer.from(hostParam, "base64").toString("utf-8");
      if (decoded.includes("admin.shopify.com/store/")) {
        shop       = `${decoded.split("admin.shopify.com/store/")[1]}.myshopify.com`;
        authSource = "base64_host";
      } else {
        shop       = hostParam;
        authSource = "raw_host";
      }
    } catch {
      shop       = hostParam;
      authSource = "raw_host_fallback";
    }
    console.log("[app.setup] loader fallback →", authSource, shop);
  }

  if (!shop) {
    console.log("[app.setup] loader: no shop → /auth/login");
    throw redirect("/auth/login");
  }

  const settings = await prisma.shopSettings.upsert({
    where:  { shop },
    create: { shop, lastActiveAt: new Date() },
    update: { lastActiveAt: new Date() },
  });

  console.log("[app.setup] loader ✅", { shop, authSource });

  return {
    shop,
    botName:      settings.botName      ?? "ShopMate",
    greeting:     settings.greeting     ?? "Hi! 👋 How can I help you today?",
    tone:         (settings.tone        ?? "Friendly").toLowerCase(),
    quickActions: (settings.quickActions as string[]) ?? ["Track my order", "Product recommendations", "Returns & exchanges"],
    error,
    host:         hostParam,
    idToken:      idTokenParam,
  };
};

// ─── Steps metadata ───────────────────────────────────────────────────────────
const steps = [
  { title: "Customize",     description: "Name, greeting & tone",        icon: Bot      },
  { title: "Quick Actions", description: "Choose what appears first",     icon: Sparkles },
  { title: "Done",          description: "Ready to go!",                  icon: Check    },
];

const toneOptions = [
  { value: "friendly",     label: "Friendly"     },
  { value: "professional", label: "Professional" },
  { value: "casual",       label: "Casual"       },
];

const ALL_QUICK_ACTIONS = [
  { label: "Track my order",           icon: "📦" },
  { label: "Product recommendations",  icon: "✨" },
  { label: "Returns & exchanges",      icon: "🔄" },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function SetupWizard() {
  const loaderData = useLoaderData<typeof loader>();
  const { host, error } = loaderData;

  // Local state — no network calls until Finish
  const [currentStep,  setCurrentStep]  = useState(0);
  const [botName,      setBotName]      = useState(loaderData.botName);
  const [greeting,     setGreeting]     = useState(loaderData.greeting);
  const [tone,         setTone]         = useState(loaderData.tone);
  const [quickActions, setQuickActions] = useState<string[]>(loaderData.quickActions);

  const shopify = useAppBridge();
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();

  // ── Watch for successful final save ──
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      console.log("[SetupWizard] Setup complete ✅ — navigating to /app");
      shopify?.toast?.show?.("✅ Setup complete!", { duration: 2000 });
      window.location.href = "/app";
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      console.error("[SetupWizard] Save error:", fetcher.data.error);
      shopify?.toast?.show?.("❌ Save failed. Please try again.", { duration: 3000 });
    }
  }, [fetcher.state, fetcher.data, shopify]);

  // ── Show loader error toasts ──
  useEffect(() => {
    if (error) {
      shopify?.toast?.show?.(`❌ ${error}`, { duration: 3000 });
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [error, shopify]);

  const handleQuickActionToggle = (action: string) => {
    setQuickActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  // Steps 1 & 2 — pure local navigation, no network
  const handleNext = () => setCurrentStep((prev) => prev + 1);
  const handleBack = () => setCurrentStep((prev) => Math.max(0, prev - 1));

  const isSaving = fetcher.state !== "idle";

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

          {/* ── Left: Wizard ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Progress bar */}
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
                      <div className={`h-0.5 flex-1 rounded transition-colors ${i < currentStep ? "bg-primary" : "bg-border"}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <h3 className="text-base font-semibold text-foreground">{steps[currentStep].title}</h3>
                <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
              </div>
            </div>

            {/* Step content card */}
            <div className="polaris-card animate-fade-in" key={currentStep}>

              {/* ── Step 1: Customize ── */}
              {currentStep === 0 && (
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold text-foreground block mb-2">Bot Name</label>
                    <Input
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
                    <p className="text-xs text-muted-foreground mt-1">
                      This affects how the AI responds to customer questions
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 2: Quick Actions ── */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select which quick action buttons to show on the home screen. At least one is required.
                  </p>
                  <div className="space-y-2">
                    {ALL_QUICK_ACTIONS.map((action) => (
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
                  {quickActions.length === 0 && (
                    <p className="text-xs text-destructive">Please select at least one quick action</p>
                  )}
                </div>
              )}

              {/* ── Step 3: Done — single useFetcher form ── */}
              {currentStep === 2 && (
                <fetcher.Form method="post" action="/app/setup">
                  {/* All collected data as hidden inputs */}
                  <input type="hidden" name="host"         value={host || ""} />
                  <input type="hidden" name="botName"      value={botName} />
                  <input type="hidden" name="greeting"     value={greeting} />
                  <input type="hidden" name="tone"         value={tone.charAt(0).toUpperCase() + tone.slice(1)} />
                  <input type="hidden" name="quickActions" value={JSON.stringify(quickActions)} />

                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto">
                      <Check className="w-8 h-8 text-accent-foreground" />
                    </div>
                    <h4 className="text-lg font-semibold text-foreground">All Set! 🎉</h4>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      ShopMate is ready to go. Your chat widget is live on your storefront.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      You can change these settings anytime from the dashboard.
                    </p>
                  </div>

                  {/* Navigation inside the fetcher form */}
                  <div className="flex justify-between gap-2 mt-6">
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={isSaving}
                      className="px-4 py-2 border border-border text-foreground hover:bg-muted rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {isSaving ? "Saving…" : "Finish Setup"}
                      {!isSaving && <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </fetcher.Form>
              )}

              {/* Navigation for steps 1 & 2 (outside fetcher form) */}
              {currentStep < 2 && (
                <div className="flex justify-between gap-2 mt-6">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className="px-4 py-2 border border-border text-foreground hover:bg-muted rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={
                      (currentStep === 0 && (!botName.trim() || !greeting.trim())) ||
                      (currentStep === 1 && quickActions.length === 0)
                    }
                    className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    Next <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* ── Right: Live Widget Preview ── */}
          <div style={{ position: "sticky", top: 20, height: "fit-content" }}>
            <div className="polaris-card p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Live Preview</h4>
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
                  <div style={{ width: 64, height: 12, backgroundColor: "hsl(0 0% 5% / 0.1)", borderRadius: 999 }} />
                </div>

                <div style={{ flex: 1, backgroundColor: "hsl(0 0% 97%)", position: "relative", overflow: "hidden" }}>
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
                      <div style={{ height: 12, width: 96,  backgroundColor: "hsl(0 0% 92%)", borderRadius: 2 }} />
                    </div>
                  </div>
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
