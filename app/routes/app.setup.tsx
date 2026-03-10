import { useState, useEffect, useRef } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, redirect } from "react-router";
import AdminLayout from "~/components/admin/AdminLayout";
import ChatWidget from "~/components/storefront/ChatWidget";
import { Check, ArrowRight, ArrowLeft, Bot, Sparkles } from "lucide-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { getSessionToken } from "@shopify/app-bridge-utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

// ─── Loader ──────────────────────────────────────────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const hostParam = url.searchParams.get("host") || "";
  const savedParam = url.searchParams.get("saved");
  const error = url.searchParams.get("error");
  const idTokenParam = url.searchParams.get("id_token") || "";

  console.log(`[app.setup] Loader START`, {
    host: hostParam ? "yes" : "no",
    idToken: idTokenParam ? "yes" : "no",
    savedParam,
    savedParamType: typeof savedParam,
    error: error || "none",
  });

  let shop: string = "";
  let authSource = "none";

  // Strategy 1: Try standard authentication if we have tokens
  const hasAuthToken = url.searchParams.has("id_token");
  const hasCookie = request.headers.get("cookie")?.includes("shopify.app.session");

  if (hasAuthToken || (hasCookie && !hostParam)) {
    console.log(`[app.setup] Attempting standard auth (tokens detected)...`);
    try {
      const { session } = await authenticate.admin(request);
      shop = session.shop;
      authSource = "admin_auth";
      console.log(`[app.setup] ✓ Auth succeeded: ${shop}`);
    } catch (authError) {
      console.log(`[app.setup] ✗ Auth failed, will try fallback`);
    }
  } else {
    console.log(`[app.setup] Skipping standard auth (no tokens + host available)`);
  }

  // Strategy 2: Fallback to host param if we don't have shop yet
  if (!shop && hostParam) {
    console.log(`[app.setup] Using fallback strategy: decoding host param...`);
    try {
      const decoded = Buffer.from(hostParam, "base64").toString("utf-8");
      if (decoded.includes("admin.shopify.com/store/")) {
        const storeName = decoded.split("admin.shopify.com/store/")[1];
        shop = `${storeName}.myshopify.com`;
        authSource = "base64_host";
      } else {
        shop = hostParam;
        authSource = "raw_host";
      }
      console.log(`[app.setup] ✓ Fallback succeeded: ${authSource} → ${shop}`);
    } catch (decodeError) {
      shop = hostParam;
      authSource = "raw_host_fallback";
      console.log(`[app.setup] ✓ Fallback (decode failed): ${authSource} → ${shop}`);
    }
  }

  // No shop found - redirect to login
  if (!shop) {
    console.log(`[app.setup] ✗ FAILED: No shop available, redirecting to login`);
    throw redirect("/auth/login");
  }

  // Success! We have shop from either auth or fallback
  console.log(`[app.setup] ✓ Shop identified: ${shop} (from ${authSource})`);

  // Load settings from database
  console.log(`[app.setup] Loading settings from DB for shop: ${shop}`);
  const settings = await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, lastActiveAt: new Date() },
    update: { lastActiveAt: new Date() },
  });

  // Return all data needed by component
  // Parse saved as a number, or null if not present
  const savedNumber = savedParam ? parseInt(savedParam, 10) : null;

  const loaderData = {
    shop,
    botName: settings.botName ?? "ShopMate",
    greeting: settings.greeting ?? "Hi! 👋 How can I help you today?",
    tone: (settings.tone ?? "Friendly").toLowerCase(),
    quickActions: settings.quickActions ?? ["Track order", "Product recommendations", "Returns & exchanges"],
    saved: savedNumber,
    error,
    host: hostParam,
    idToken: idTokenParam, // Preserve id_token for next redirects
  };

  console.log(`[app.setup] ✓ Loader completed:`, {
    shop: loaderData.shop,
    saved: loaderData.saved,
    savedType: typeof loaderData.saved,
    savedParam,
    host: hostParam ? "✓" : "✗",
    idToken: idTokenParam ? "✓" : "✗",
  });
  return loaderData;
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
  const { host, idToken, saved } = loaderData;
  const [currentStep, setCurrentStep] = useState(0);
  const [botName, setBotName] = useState(loaderData.botName);
  const [greeting, setGreeting] = useState(loaderData.greeting);
  const [tone, setTone] = useState(loaderData.tone);
  const [quickActions, setQuickActions] = useState(loaderData.quickActions);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shopify = useAppBridge();
  const processedSaveRef = useRef<number | null>(null);

  // 🔍 RENDERING-LEVEL DEBUG: Log on every render
  console.log("[SetupWizard] 🎬 RENDER - loaderData:", {
    shop: loaderData.shop,
    saved,
    savedType: typeof saved,
    host: host ? "yes" : "no",
    idToken: idToken ? "yes" : "no",
  });
  console.log("[SetupWizard] 🎬 RENDER - currentStep:", currentStep);

  // Build form action URL with Shopify context params (host + id_token)
  // Use simple string concatenation (SSR-safe, no window object)
  let formAction = "/app/setup/save";
  const params: string[] = [];
  if (host) params.push(`host=${encodeURIComponent(host)}`);
  if (idToken) params.push(`id_token=${encodeURIComponent(idToken)}`);
  if (params.length > 0) formAction += `?${params.join("&")}`;

  // 🔍 DEBUG: Verify shopify instance exists and has required methods
  useEffect(() => {
    console.log("[SetupWizard] 🔍 DEBUG: shopify instance check:", {
      exists: !!shopify,
      type: typeof shopify,
      hasToast: shopify && typeof shopify.toast?.show === "function",
      hasWebApi: shopify && typeof shopify.webApi === "object",
      webApiMethods: shopify?.webApi ? Object.keys(shopify.webApi) : "no webApi",
      allMethods: shopify ? Object.keys(shopify) : "shopify is null",
    });

    if (shopify && !shopify.webApi) {
      console.error("[SetupWizard] 🔍 CRITICAL: shopify.webApi is missing! App Bridge not properly initialized.");
      console.error("[SetupWizard] 🔍 Available properties:", Object.keys(shopify));
    }
  }, [shopify]);

  // Helper: Dynamic polling for App Bridge readiness
  const waitForAppBridge = (timeoutMs = 2000): Promise<void> => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = Math.ceil(timeoutMs / 100);

      const checkReady = () => {
        attempts++;

        if (shopify?.webApi?.subscribe) {
          console.log(`[SetupWizard] ✓ App Bridge ready after ${attempts} attempt(s)`);
          resolve();
          return;
        }

        if (attempts % 5 === 0) {
          console.log(`[SetupWizard] ⏳ Polling App Bridge... attempt ${attempts}/${maxAttempts}`);
        }

        if (attempts >= maxAttempts) {
          console.error(`[SetupWizard] ❌ App Bridge timeout after ${attempts} attempts (${timeoutMs}ms)`);
          console.error("[SetupWizard] 🔍 shopify state:", {
            exists: !!shopify,
            hasWebApi: !!shopify?.webApi,
            hasSubscribe: !!shopify?.webApi?.subscribe,
            webApiMethods: shopify?.webApi ? Object.keys(shopify.webApi) : "none",
          });
          reject(new Error("App Bridge initialization timeout"));
          return;
        }

        setTimeout(checkReady, 100);
      };

      checkReady();
    });
  };

  // ── IMMEDIATE: Process saved state if present ──
  // Check for saved BEFORE useEffect so it runs even if saved present on mount
  if (saved !== null && saved !== undefined && processedSaveRef.current !== saved) {
    console.log(`[SetupWizard] 🔥 IMMEDIATE: Detected saved=${saved}, processing immediately (ref was ${processedSaveRef.current})`);
    processedSaveRef.current = saved;

    // Use setTimeout to ensure this runs after render, allowing toast/effects
    setTimeout(async () => {
      try {
        console.log("[SetupWizard] 🔥 IMMEDIATE: setTimeout callback starting...");
        console.log("[SetupWizard] 🔥 IMMEDIATE: shopify instance in callback:", {
          exists: !!shopify,
          type: typeof shopify,
          hasWebApi: !!shopify?.webApi,
        });

        if (!shopify) {
          console.error("[SetupWizard] 🔥 IMMEDIATE: ❌ shopify is null/undefined!");
          return;
        }

        console.log("[SetupWizard] 🔥 IMMEDIATE: showing toast...");
        shopify.toast.show("✅ Saved!", { duration: 2000 });

        // DYNAMIC POLLING: Wait for App Bridge to be fully ready
        console.log("[SetupWizard] 🔥 IMMEDIATE: ⏳ Waiting for App Bridge to initialize...");
        try {
          await waitForAppBridge(2000);
        } catch (waitError) {
          console.error("[SetupWizard] 🔥 IMMEDIATE: App Bridge initialization failed:", waitError instanceof Error ? waitError.message : String(waitError));
          return;
        }

        console.log("[SetupWizard] 🔥 IMMEDIATE: App Bridge ready, calling getSessionToken...");
        let tokenPromise;
        try {
          tokenPromise = getSessionToken(shopify);
          console.log("[SetupWizard] 🔥 IMMEDIATE: getSessionToken call succeeded, returned:", {
            isPromise: tokenPromise instanceof Promise,
            type: typeof tokenPromise,
          });
        } catch (callError) {
          console.error("[SetupWizard] 🔥 IMMEDIATE: getSessionToken threw during call:", {
            message: callError instanceof Error ? callError.message : String(callError),
            stack: callError instanceof Error ? callError.stack : "no stack",
          });
          return;
        }

        tokenPromise
          .then((token) => {
            console.log(`[SetupWizard] ✓ IMMEDIATE session token obtained:`, {
              hasToken: !!token,
              length: token?.length || 0,
              preview: token ? token.substring(0, 20) + "..." : "empty",
            });
          })
          .catch((error) => {
            console.error(`[SetupWizard] ✗ IMMEDIATE session token failed:`, {
              message: error?.message || String(error),
              stack: error?.stack || "no stack",
              error,
            });
          });

        // Auto-advance to next step
        console.log("[SetupWizard] 🔥 IMMEDIATE: Auto-advancing to next step");
        setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));

        // Clear saved param from URL
        const url = new URL(window.location.href);
        url.searchParams.delete("saved");
        window.history.replaceState({}, "", url.toString());
      } catch (err) {
        console.error("[SetupWizard] 🔥 IMMEDIATE: Exception in setTimeout:", {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : "no stack",
        });
      }
    }, 0);
  }

  // ── MOUNT: Force refresh Shopify session on initial load ──
  useEffect(() => {
    try {
      console.log("[SetupWizard] 📍 useEffect(mount) - shopify instance:", {
        exists: !!shopify,
        type: typeof shopify,
        hasWebApi: shopify && !!shopify.webApi,
        hasSubscribe: shopify && !!shopify.webApi?.subscribe,
      });

      if (!shopify) {
        console.error("[SetupWizard] 📍 useEffect(mount): shopify is null/undefined!");
        return;
      }

      // Use polling to wait for App Bridge to initialize
      const initializeSession = async () => {
        console.log("[SetupWizard] 📍 useEffect(mount): ⏳ Waiting for App Bridge to initialize...");
        try {
          await waitForAppBridge(2000);
        } catch (waitError) {
          console.warn("[SetupWizard] 📍 useEffect(mount): App Bridge not ready yet, skipping initial session refresh");
          return;
        }

        console.log("[SetupWizard] 📍 useEffect(mount): App Bridge ready, calling getSessionToken...");
        let tokenPromise;
        try {
          tokenPromise = getSessionToken(shopify);
          console.log("[SetupWizard] 📍 useEffect(mount) - getSessionToken call succeeded");
        } catch (callError) {
          console.error("[SetupWizard] 📍 useEffect(mount) - getSessionToken threw during call:", {
            message: callError instanceof Error ? callError.message : String(callError),
            stack: callError instanceof Error ? callError.stack : "no stack",
          });
          return;
        }

        tokenPromise
          .then((token) => {
            console.log("[SetupWizard] ✅ useEffect(mount) - session token obtained:", {
              hasToken: !!token,
              length: token?.length || 0,
              preview: token ? token.substring(0, 20) + "..." : "empty",
            });
          })
          .catch((error) => {
            console.error("[SetupWizard] ❌ useEffect(mount) - session token failed:", {
              message: error?.message || String(error),
              stack: error?.stack || "no stack",
              error,
            });
          });
      };

      initializeSession();
    } catch (err) {
      console.error("[SetupWizard] 📍 useEffect(mount) - Exception:", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : "no stack",
      });
    }
  }, [shopify]);

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
              action={formAction}
              target="_top"
              className="polaris-card animate-fade-in"
              key={currentStep}
              onSubmit={(e) => {
                setIsSubmitting(true);
                // Allow default form submission to proceed
              }}
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

              {/* Navigation - INSIDE FORM so submit button works */}
              <div className="flex justify-between gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                  className="px-4 py-2 border border-border text-foreground hover:bg-muted rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>
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
            </form>
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
