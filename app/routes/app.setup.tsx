import { useState, useEffect } from "react";
import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, redirect } from "react-router";
import AdminLayout from "~/components/admin/AdminLayout";
import WizardPreview from "~/components/admin/WizardPreview";
import { Check, ArrowRight, ArrowLeft, Bot, Sparkles } from "lucide-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Input } from "~/components/ui/input";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

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
  { title: "Customize",     description: "Name, greeting & tone",     icon: Bot      },
  { title: "Quick Actions", description: "Choose what appears first", icon: Sparkles },
  { title: "Done",          description: "Ready to go!",              icon: Check    },
];

const toneOptions = [
  { value: "friendly",     label: "Friendly"     },
  { value: "professional", label: "Professional" },
  { value: "casual",       label: "Casual"       },
];

const ALL_QUICK_ACTIONS = [
  { label: "Track my order",          icon: "📦" },
  { label: "Product recommendations", icon: "✨" },
  { label: "Returns & exchanges",     icon: "🔄" },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function SetupWizard() {
  const loaderData = useLoaderData<typeof loader>();
  const { error } = loaderData;

  // All state is local — no network calls during the wizard
  const [currentStep,  setCurrentStep]  = useState(0);
  const [botName,      setBotName]      = useState(loaderData.botName);
  const [greeting,     setGreeting]     = useState(loaderData.greeting);
  const [tone,         setTone]         = useState(loaderData.tone);
  // Only keep labels that exist in ALL_QUICK_ACTIONS to prevent stale/legacy
  // DB values (e.g. "Track order", "Talk to human") from appearing as duplicates.
  const [quickActions, setQuickActions] = useState<string[]>(
    loaderData.quickActions.filter((a) =>
      ALL_QUICK_ACTIONS.some((q) => q.label === a)
    )
  );

  const shopify = useAppBridge();

  // Show loader error toasts
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

  // Steps 1 & 2 — pure local navigation
  const handleNext = () => setCurrentStep((prev) => prev + 1);
  const handleBack = () => setCurrentStep((prev) => Math.max(0, prev - 1));

  // Step 3 — navigate to /app with wizard values as GET params.
  //
  // Why GET instead of POST?
  //   POST body is consumed by Shopify's auth-session-token redirect (302 in ~7ms)
  //   before the action ever reads it → data permanently lost.
  //   GET URL params survive Shopify's redirect dance intact, so the loader
  //   can read them after authenticate.admin() succeeds.
  function saveAndGoToDashboard() {
    const target = new URL(window.location.href);
    target.pathname = "/app";

    // Remove any leftover routing markers
    target.searchParams.delete("index");

    // Embed wizard values in URL (short param names to keep URL compact)
    target.searchParams.set("wizard_save", "1");
    target.searchParams.set("wbn", botName.trim()  || "ShopMate");
    target.searchParams.set("wgr", greeting.trim() || "Hi! 👋 How can I help you today?");
    target.searchParams.set("wtn", tone            || "friendly");
    target.searchParams.set("wqa", JSON.stringify(quickActions));

    window.location.href = target.toString();
  }

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
                    <p className="text-xs text-muted-foreground mt-1.5 italic">
                      Greeting is the first message customers see. Write anything that fits your brand. Tone only affects how the AI responds after that.
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
                      Tone changes the AI's speaking style — preview examples below show the difference.
                    </p>

                    {/* ── Tone preview examples ── */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          value:   "friendly",
                          label:   "Friendly",
                          color:   "#008060",
                          bg:      "hsl(160 100% 97%)",
                          border:  "#008060",
                          example: "Hey there! 😊 What's up? Ready to find something awesome today?",
                        },
                        {
                          value:   "professional",
                          label:   "Professional",
                          color:   "#1d4ed8",
                          bg:      "hsl(220 100% 97%)",
                          border:  "#1d4ed8",
                          example: "Hello! How may I assist you today? I'm here to help with your order or questions.",
                        },
                        {
                          value:   "casual",
                          label:   "Casual",
                          color:   "#7c3aed",
                          bg:      "hsl(260 100% 97%)",
                          border:  "#7c3aed",
                          example: "Yo! What's good? Need help finding something cool?",
                        },
                      ].map((ex) => (
                        <button
                          key={ex.value}
                          type="button"
                          onClick={() => setTone(ex.value)}
                          style={{
                            background:   ex.bg,
                            border:       `1.5px solid ${tone === ex.value ? ex.color : "hsl(210 10% 88%)"}`,
                            borderRadius: 10,
                            padding:      "10px 12px",
                            textAlign:    "left",
                            cursor:       "pointer",
                            transition:   "border-color 0.15s, box-shadow 0.15s",
                            boxShadow:    tone === ex.value ? `0 0 0 3px ${ex.color}22` : "none",
                          }}
                        >
                          {/* Widget header strip */}
                          <div
                            style={{
                              background:   ex.color,
                              borderRadius: "6px 6px 0 0",
                              padding:      "4px 8px",
                              marginBottom: 6,
                              display:      "flex",
                              alignItems:   "center",
                              gap:          6,
                            }}
                          >
                            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(255,255,255,0.9)", flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>
                              {ex.label}
                            </span>
                          </div>
                          {/* Example bubble */}
                          <p style={{ margin: 0, fontSize: 11, color: "hsl(208 5% 40%)", fontStyle: "italic", lineHeight: 1.45 }}>
                            "{ex.example}"
                          </p>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Click a card to select that tone
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

              {/* ── Step 3: Done — no saving, just navigate to dashboard ── */}
              {currentStep === 2 && (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8 text-accent-foreground" />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground">All Set! 🎉</h4>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Your ShopMate widget is ready. Head to the dashboard to save your preferences and go live.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can change these settings anytime from the dashboard.
                  </p>

                  <div className="flex justify-between gap-2 mt-6">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="px-4 py-2 border border-border text-foreground hover:bg-muted rounded-md text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={saveAndGoToDashboard}
                      className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      Save &amp; Go to Dashboard <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation for steps 1 & 2 */}
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

                <div style={{ flex: 1, backgroundColor: "hsl(0 0% 97%)", position: "relative", overflow: "hidden", padding: 12 }}>
                  <WizardPreview
                    botName={botName || "ShopMate AI"}
                    greeting={greeting}
                    quickActions={quickActions}
                  />
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
