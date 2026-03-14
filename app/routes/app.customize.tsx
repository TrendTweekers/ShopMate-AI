/**
 * Customize page — Widget Colors & Appearance
 *
 * Merchants pick exact hex colors for every part of the chat widget.
 * Values are stored in DB and fetched by chat-widget.js on the storefront.
 */

import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, Form } from "react-router";
import { useState, useEffect } from "react";
import { Palette, Check, RotateCcw } from "lucide-react";
import { authenticate } from "../shopify.server";
import AdminLayout from "~/components/admin/AdminLayout";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Colors {
  headerBgColor:   string;
  headerTextColor: string;
  bubbleBgColor:   string;
  bubbleTextColor: string;
  buttonBgColor:   string;
  buttonTextColor: string;
}

// ─── Preset themes ────────────────────────────────────────────────────────────

const PRESETS: Array<{ name: string; colors: Colors }> = [
  {
    name: "ShopMate Green",
    colors: {
      headerBgColor:   "#008060",
      headerTextColor: "#ffffff",
      bubbleBgColor:   "#008060",
      bubbleTextColor: "#ffffff",
      buttonBgColor:   "#008060",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Ocean Blue",
    colors: {
      headerBgColor:   "#2563eb",
      headerTextColor: "#ffffff",
      bubbleBgColor:   "#2563eb",
      bubbleTextColor: "#ffffff",
      buttonBgColor:   "#2563eb",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Royal Purple",
    colors: {
      headerBgColor:   "#7c3aed",
      headerTextColor: "#ffffff",
      bubbleBgColor:   "#7c3aed",
      bubbleTextColor: "#ffffff",
      buttonBgColor:   "#7c3aed",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Midnight",
    colors: {
      headerBgColor:   "#111827",
      headerTextColor: "#ffffff",
      bubbleBgColor:   "#111827",
      bubbleTextColor: "#ffffff",
      buttonBgColor:   "#111827",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Sunset Orange",
    colors: {
      headerBgColor:   "#ea580c",
      headerTextColor: "#ffffff",
      bubbleBgColor:   "#ea580c",
      bubbleTextColor: "#ffffff",
      buttonBgColor:   "#ea580c",
      buttonTextColor: "#ffffff",
    },
  },
];

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.shopSettings.upsert({
    where:  { shop: session.shop },
    create: { shop: session.shop, lastActiveAt: new Date() },
    update: { lastActiveAt: new Date() },
    select: {
      headerBgColor:   true,
      headerTextColor: true,
      bubbleBgColor:   true,
      bubbleTextColor: true,
      buttonBgColor:   true,
      buttonTextColor: true,
    },
  });
  return {
    shop: session.shop,
    colors: {
      headerBgColor:   settings.headerBgColor   ?? "#008060",
      headerTextColor: settings.headerTextColor ?? "#ffffff",
      bubbleBgColor:   settings.bubbleBgColor   ?? "#008060",
      bubbleTextColor: settings.bubbleTextColor ?? "#ffffff",
      buttonBgColor:   settings.buttonBgColor   ?? "#008060",
      buttonTextColor: settings.buttonTextColor ?? "#ffffff",
    } as Colors,
  };
};

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();

  const colors: Colors = {
    headerBgColor:   (fd.get("headerBgColor")   as string) || "#008060",
    headerTextColor: (fd.get("headerTextColor") as string) || "#ffffff",
    bubbleBgColor:   (fd.get("bubbleBgColor")   as string) || "#008060",
    bubbleTextColor: (fd.get("bubbleTextColor") as string) || "#ffffff",
    buttonBgColor:   (fd.get("buttonBgColor")   as string) || "#008060",
    buttonTextColor: (fd.get("buttonTextColor") as string) || "#ffffff",
  };

  await prisma.shopSettings.upsert({
    where:  { shop: session.shop },
    create: { shop: session.shop, ...colors },
    update: colors,
  });

  return { ok: true, colors };
};

// ─── Color field config ───────────────────────────────────────────────────────

const FIELDS: Array<{ key: keyof Colors; label: string; hint: string }> = [
  { key: "headerBgColor",   label: "Header Background",    hint: "Chat window header & gradient" },
  { key: "headerTextColor", label: "Header Text / Icons",  hint: "Bot name, subtitle, close button" },
  { key: "bubbleBgColor",   label: "Launcher Bubble",      hint: "Floating chat button background" },
  { key: "bubbleTextColor", label: "Launcher Icon",        hint: "Icon color inside the bubble" },
  { key: "buttonBgColor",   label: "User Message & Send",  hint: "Customer chat bubble + send button" },
  { key: "buttonTextColor", label: "User Message Text",    hint: "Text inside customer chat bubbles" },
];

// ─── Mini live preview ────────────────────────────────────────────────────────

function MiniPreview({ colors }: { colors: Colors }) {
  const initials = "SM";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      {/* Widget window */}
      <div style={{
        width: 260,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        boxShadow: "0 4px 20px rgba(0,0,0,.10)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          background: colors.headerBgColor,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: colors.headerTextColor }}>{initials}</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.headerTextColor, lineHeight: 1.2 }}>
              Your Bot Name
            </p>
            <p style={{ margin: 0, fontSize: 9, color: colors.headerTextColor, opacity: 0.75, lineHeight: 1.2 }}>
              Shop Assistant
            </p>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 16, color: colors.headerTextColor, opacity: 0.7, lineHeight: 1 }}>×</span>
        </div>

        {/* Body */}
        <div style={{ background: "#f9fafb", padding: "10px 10px 6px" }}>
          {/* Bot greeting */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 8, padding: "7px 9px", marginBottom: 8,
          }}>
            <p style={{ margin: 0, fontSize: 11, color: "#374151" }}>Hi! 👋 How can I help you?</p>
          </div>
          {/* User bubble */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <div style={{
              background: colors.buttonBgColor,
              borderRadius: "10px 10px 2px 10px",
              padding: "7px 9px",
              maxWidth: "70%",
            }}>
              <p style={{ margin: 0, fontSize: 11, color: colors.buttonTextColor }}>Track my order</p>
            </div>
          </div>
        </div>

        {/* Input row */}
        <div style={{
          background: "#fff", borderTop: "1px solid #e5e7eb",
          padding: "8px 10px", display: "flex", gap: 6, alignItems: "center",
        }}>
          <div style={{
            flex: 1, height: 28, borderRadius: 8,
            border: "1px solid #d1d5db", background: "#f9fafb",
          }} />
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: colors.buttonBgColor,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.buttonTextColor} strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
        </div>
      </div>

      {/* Launcher bubble */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: colors.bubbleBgColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 14px rgba(0,0,0,.18)",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.bubbleTextColor} strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>Launcher bubble</p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomizePage() {
  const { colors: savedColors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSaving = navigation.state === "submitting";
  const [colors, setColors] = useState<Colors>(savedColors);
  const [savedOk, setSavedOk] = useState(false);

  // Show success flash when action returns ok
  useEffect(() => {
    if (actionData?.ok) {
      setSavedOk(true);
      const t = setTimeout(() => setSavedOk(false), 3000);
      return () => clearTimeout(t);
    }
  }, [actionData]);

  // Keep local state in sync if saved colors come back from action
  useEffect(() => {
    if (actionData?.colors) setColors(actionData.colors);
  }, [actionData]);

  function applyPreset(preset: typeof PRESETS[0]) {
    setColors(preset.colors);
  }

  function resetColors() {
    setColors(PRESETS[0].colors);
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 940, margin: "0 auto" }} className="space-y-6">

        {/* ── Page header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Palette size={22} color="#008060" />
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
                Widget Colors
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                Customize every color of your chat widget. Changes apply instantly on your storefront.
              </p>
            </div>
          </div>
        </div>

        {/* ── Success banner ── */}
        {savedOk && (
          <div style={{
            padding: "10px 16px",
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "#166534",
          }}>
            <Check size={15} color="#16a34a" />
            Colors saved! Your storefront widget will update within a few seconds.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>

          {/* ── Left: Pickers + Presets ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Preset themes */}
            <div className="polaris-card">
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "#111827" }}>
                Quick Presets
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: `1.5px solid ${colors.headerBgColor === preset.colors.headerBgColor ? preset.colors.headerBgColor : "#e5e7eb"}`,
                      background: colors.headerBgColor === preset.colors.headerBgColor ? `${preset.colors.headerBgColor}12` : "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#374151",
                      transition: "border-color .15s",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%",
                      background: preset.colors.headerBgColor,
                      border: "1px solid rgba(0,0,0,.1)",
                      flexShrink: 0,
                    }} />
                    {preset.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetColors}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 12px", borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    cursor: "pointer", fontSize: 12, color: "#6b7280",
                  }}
                >
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
            </div>

            {/* Color pickers */}
            <Form method="post">
              {/* Hidden inputs keep form values in sync with React state */}
              {FIELDS.map(({ key }) => (
                <input key={key} type="hidden" name={key} value={colors[key]} />
              ))}

              <div className="polaris-card">
                <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "#111827" }}>
                  Custom Colors
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {FIELDS.map(({ key, label, hint }) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      {/* Native color picker */}
                      <label
                        htmlFor={key}
                        style={{
                          width: 40, height: 40, borderRadius: 8,
                          border: "2px solid #e5e7eb",
                          background: colors[key],
                          cursor: "pointer",
                          display: "block",
                          flexShrink: 0,
                          overflow: "hidden",
                          position: "relative",
                        }}
                        title={`Pick ${label}`}
                      >
                        <input
                          id={key}
                          type="color"
                          value={colors[key]}
                          onChange={(e) => setColors((prev) => ({ ...prev, [key]: e.target.value }))}
                          style={{
                            position: "absolute", inset: 0,
                            width: "100%", height: "100%",
                            opacity: 0, cursor: "pointer", border: "none",
                          }}
                        />
                      </label>

                      {/* Hex display */}
                      <input
                        type="text"
                        value={colors[key]}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                            setColors((prev) => ({ ...prev, [key]: v }));
                          }
                        }}
                        style={{
                          width: 90, padding: "6px 10px",
                          border: "1px solid #d1d5db",
                          borderRadius: 7, fontSize: 13,
                          fontFamily: "monospace", color: "#111827",
                        }}
                      />

                      {/* Label + hint */}
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{label}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{hint}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save button */}
                <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    disabled={isSaving}
                    style={{
                      padding: "9px 24px",
                      borderRadius: 8,
                      background: isSaving ? "#d1fae5" : "#008060",
                      color: "#fff",
                      border: "none",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: isSaving ? "default" : "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      transition: "background .15s",
                    }}
                  >
                    {isSaving ? (
                      <><span style={{ fontSize: 14 }}>⏳</span> Saving…</>
                    ) : savedOk ? (
                      <><Check size={14} /> Saved!</>
                    ) : (
                      "Save Colors"
                    )}
                  </button>
                </div>
              </div>
            </Form>
          </div>

          {/* ── Right: Live preview ── */}
          <div style={{ position: "sticky", top: 20 }}>
            <div className="polaris-card">
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#111827" }}>
                Live Preview
              </h3>
              <MiniPreview colors={colors} />
              <p style={{ margin: "14px 0 0", fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
                Updates as you pick colors
              </p>
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
