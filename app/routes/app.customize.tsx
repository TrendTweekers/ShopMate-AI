/**
 * Widget Colors — visual color customization for the chat widget.
 * Big preset circles + individual pickers + live preview.
 */

import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, Form } from "react-router";
import { useState, useEffect } from "react";
import { Check, RotateCcw, Palette } from "lucide-react";
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

// ─── Presets (12 vibrant circles) ─────────────────────────────────────────────

const PRESETS: Array<{ name: string; swatch: string; colors: Colors }> = [
  {
    name: "ShopMate Green",
    swatch: "#008060",
    colors: { headerBgColor: "#008060", headerTextColor: "#ffffff", bubbleBgColor: "#008060", bubbleTextColor: "#ffffff", buttonBgColor: "#008060", buttonTextColor: "#ffffff" },
  },
  {
    name: "Emerald",
    swatch: "#10b981",
    colors: { headerBgColor: "#10b981", headerTextColor: "#ffffff", bubbleBgColor: "#10b981", bubbleTextColor: "#ffffff", buttonBgColor: "#10b981", buttonTextColor: "#ffffff" },
  },
  {
    name: "Ocean Blue",
    swatch: "#2563eb",
    colors: { headerBgColor: "#2563eb", headerTextColor: "#ffffff", bubbleBgColor: "#2563eb", bubbleTextColor: "#ffffff", buttonBgColor: "#2563eb", buttonTextColor: "#ffffff" },
  },
  {
    name: "Sky",
    swatch: "#0ea5e9",
    colors: { headerBgColor: "#0ea5e9", headerTextColor: "#ffffff", bubbleBgColor: "#0ea5e9", bubbleTextColor: "#ffffff", buttonBgColor: "#0ea5e9", buttonTextColor: "#ffffff" },
  },
  {
    name: "Royal Purple",
    swatch: "#7c3aed",
    colors: { headerBgColor: "#7c3aed", headerTextColor: "#ffffff", bubbleBgColor: "#7c3aed", bubbleTextColor: "#ffffff", buttonBgColor: "#7c3aed", buttonTextColor: "#ffffff" },
  },
  {
    name: "Pink",
    swatch: "#ec4899",
    colors: { headerBgColor: "#ec4899", headerTextColor: "#ffffff", bubbleBgColor: "#ec4899", bubbleTextColor: "#ffffff", buttonBgColor: "#ec4899", buttonTextColor: "#ffffff" },
  },
  {
    name: "Sunset Orange",
    swatch: "#ea580c",
    colors: { headerBgColor: "#ea580c", headerTextColor: "#ffffff", bubbleBgColor: "#ea580c", bubbleTextColor: "#ffffff", buttonBgColor: "#ea580c", buttonTextColor: "#ffffff" },
  },
  {
    name: "Golden",
    swatch: "#d97706",
    colors: { headerBgColor: "#d97706", headerTextColor: "#ffffff", bubbleBgColor: "#d97706", bubbleTextColor: "#ffffff", buttonBgColor: "#d97706", buttonTextColor: "#ffffff" },
  },
  {
    name: "Rose Red",
    swatch: "#e11d48",
    colors: { headerBgColor: "#e11d48", headerTextColor: "#ffffff", bubbleBgColor: "#e11d48", bubbleTextColor: "#ffffff", buttonBgColor: "#e11d48", buttonTextColor: "#ffffff" },
  },
  {
    name: "Midnight",
    swatch: "#111827",
    colors: { headerBgColor: "#111827", headerTextColor: "#ffffff", bubbleBgColor: "#111827", bubbleTextColor: "#ffffff", buttonBgColor: "#111827", buttonTextColor: "#ffffff" },
  },
  {
    name: "Slate",
    swatch: "#475569",
    colors: { headerBgColor: "#475569", headerTextColor: "#ffffff", bubbleBgColor: "#475569", bubbleTextColor: "#ffffff", buttonBgColor: "#475569", buttonTextColor: "#ffffff" },
  },
  {
    name: "Soft White",
    swatch: "#f8fafc",
    colors: { headerBgColor: "#f8fafc", headerTextColor: "#111827", bubbleBgColor: "#111827", bubbleTextColor: "#ffffff", buttonBgColor: "#111827", buttonTextColor: "#ffffff" },
  },
];

const DEFAULT_COLORS: Colors = PRESETS[0].colors;

// ─── Field config ─────────────────────────────────────────────────────────────

const FIELDS: Array<{ key: keyof Colors; label: string; hint: string }> = [
  { key: "headerBgColor",   label: "Header Background",   hint: "Chat window header colour" },
  { key: "headerTextColor", label: "Header Text & Icons", hint: "Bot name, close button" },
  { key: "bubbleBgColor",   label: "Launcher Bubble",     hint: "Floating chat button" },
  { key: "bubbleTextColor", label: "Launcher Icon",       hint: "Icon inside the bubble" },
  { key: "buttonBgColor",   label: "User Bubble & Send",  hint: "Customer messages + send button" },
  { key: "buttonTextColor", label: "User Bubble Text",    hint: "Text inside customer messages" },
];

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.shopSettings.upsert({
    where:  { shop: session.shop },
    create: { shop: session.shop, lastActiveAt: new Date() },
    update: { lastActiveAt: new Date() },
    select: {
      headerBgColor: true, headerTextColor: true,
      bubbleBgColor: true, bubbleTextColor: true,
      buttonBgColor: true, buttonTextColor: true,
    },
  });
  return {
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

// ─── Live Preview ─────────────────────────────────────────────────────────────

function LivePreview({ colors }: { colors: Colors }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {/* Widget window */}
      <div style={{
        width: 270,
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.13)",
        border: "1px solid #e5e7eb",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#fff",
      }}>
        {/* Header */}
        <div style={{
          background: colors.headerBgColor,
          padding: "12px 14px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, border: "2px solid rgba(255,255,255,0.35)",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: colors.headerTextColor }}>SM</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.headerTextColor, lineHeight: 1.2 }}>
              Your Bot Name
            </p>
            <p style={{ margin: 0, fontSize: 10, color: colors.headerTextColor, opacity: 0.72, lineHeight: 1.3 }}>
              Shop Assistant • Online
            </p>
          </div>
          <span style={{ color: colors.headerTextColor, opacity: 0.7, fontSize: 18, lineHeight: 1 }}>×</span>
        </div>

        {/* Chat body */}
        <div style={{ background: "#f9fafb", padding: "12px 12px 8px" }}>
          {/* Bot message */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "10px 10px 10px 2px",
            padding: "8px 11px", marginBottom: 10, maxWidth: "85%",
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
              Hi! 👋 How can I help you today?
            </p>
          </div>

          {/* Quick action button */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 11px", borderRadius: 9,
            border: "1px solid #e5e7eb", background: "#fff",
            marginBottom: 6,
          }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#008060" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h6l3 6v3h-3"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#111827" }}>Track my order</span>
          </div>

          {/* User message */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <div style={{
              background: colors.buttonBgColor,
              borderRadius: "10px 10px 2px 10px",
              padding: "8px 11px", maxWidth: "78%",
            }}>
              <p style={{ margin: 0, fontSize: 12, color: colors.buttonTextColor, lineHeight: 1.5 }}>
                Where is my order #1234?
              </p>
            </div>
          </div>

          {/* Bot reply */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "10px 10px 10px 2px",
            padding: "8px 11px", marginBottom: 4, maxWidth: "85%",
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
              Let me look that up for you! 🔍
            </p>
          </div>
        </div>

        {/* Input row */}
        <div style={{
          background: "#fff", borderTop: "1px solid #e5e7eb",
          padding: "9px 10px",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <div style={{
            flex: 1, height: 32, borderRadius: 9,
            border: "1px solid #d1d5db", background: "#f9fafb",
            display: "flex", alignItems: "center", paddingLeft: 10,
          }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>Type a message…</span>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: colors.buttonBgColor,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.buttonTextColor} strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Launcher bubble */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: colors.bubbleBgColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.20)",
          transition: "background 0.2s",
        }}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={colors.bubbleTextColor} strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <span style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>Launcher bubble</span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomizePage() {
  const { colors: savedColors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation  = useNavigation();

  const isSaving = navigation.state === "submitting";
  const [colors, setColors]   = useState<Colors>(savedColors);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    if (actionData?.ok) {
      setSavedOk(true);
      const t = setTimeout(() => setSavedOk(false), 3000);
      return () => clearTimeout(t);
    }
  }, [actionData]);

  useEffect(() => {
    if (actionData?.colors) setColors(actionData.colors);
  }, [actionData]);

  function applyPreset(preset: typeof PRESETS[0]) {
    setColors(preset.colors);
    setActivePreset(preset.name);
  }

  function updateColor(key: keyof Colors, value: string) {
    setColors((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null); // deselect preset when manually editing
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* ── Page header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "linear-gradient(135deg, #008060, #10b981)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,128,96,0.3)",
          }}>
            <Palette size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>
              Widget Colors
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280", marginTop: 2 }}>
              Pick a preset or mix your own — preview updates live.
            </p>
          </div>
        </div>

        {/* ── Success banner ── */}
        {savedOk && (
          <div style={{
            marginBottom: 20,
            padding: "11px 16px",
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 10,
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 13, color: "#166534",
          }}>
            <Check size={15} color="#16a34a" />
            Colors saved! Your storefront widget will update within seconds.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>

          {/* ── Left column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── Preset circles ── */}
            <div style={{
              background: "#fff",
              borderRadius: 16,
              padding: "24px 24px 20px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
              border: "1px solid #f3f4f6",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
                    Quick Presets
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9ca3af" }}>
                    Click any color to apply it instantly
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setColors(DEFAULT_COLORS); setActivePreset("ShopMate Green"); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 12px", borderRadius: 8,
                    border: "1px solid #e5e7eb", background: "#f9fafb",
                    cursor: "pointer", fontSize: 12, color: "#6b7280",
                    fontWeight: 500, transition: "background .15s",
                  }}
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>

              {/* Circle grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: "16px 12px",
              }}>
                {PRESETS.map((preset) => {
                  const isSelected = activePreset === preset.name;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      title={preset.name}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 7,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px 2px",
                      }}
                    >
                      {/* Circle */}
                      <div style={{
                        width: 68,
                        height: 68,
                        borderRadius: "50%",
                        background: preset.swatch,
                        border: isSelected
                          ? `4px solid ${preset.swatch}`
                          : "3px solid transparent",
                        outline: isSelected
                          ? "3px solid #fff"
                          : "3px solid transparent",
                        boxShadow: isSelected
                          ? `0 0 0 5px ${preset.swatch}55, 0 6px 20px ${preset.swatch}44`
                          : `0 3px 12px ${preset.swatch}40`,
                        transition: "all 0.18s cubic-bezier(0.4,0,0.2,1)",
                        transform: isSelected ? "scale(1.12)" : "scale(1)",
                        position: "relative",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {isSelected && (
                          <Check
                            size={22}
                            color={preset.colors.headerTextColor}
                            strokeWidth={3}
                          />
                        )}
                        {/* White border ring for light swatches */}
                        {preset.swatch === "#f8fafc" && (
                          <div style={{
                            position: "absolute", inset: -2,
                            borderRadius: "50%", border: "2px solid #d1d5db",
                          }} />
                        )}
                      </div>
                      {/* Label */}
                      <span style={{
                        fontSize: 10,
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? "#111827" : "#6b7280",
                        textAlign: "center",
                        lineHeight: 1.3,
                        maxWidth: 70,
                        transition: "color 0.15s",
                      }}>
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Custom color pickers ── */}
            <Form method="post">
              {/* Hidden inputs sync React state → form */}
              {FIELDS.map(({ key }) => (
                <input key={key} type="hidden" name={key} value={colors[key]} />
              ))}

              <div style={{
                background: "#fff",
                borderRadius: 16,
                padding: "24px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
                border: "1px solid #f3f4f6",
              }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
                  Custom Colors
                </h3>
                <p style={{ margin: "0 0 20px", fontSize: 12, color: "#9ca3af" }}>
                  Fine-tune individual parts of the widget
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {FIELDS.map(({ key, label, hint }) => (
                    <div
                      key={key}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: "1px solid #f3f4f6",
                        background: "#fafafa",
                        transition: "border-color .15s",
                      }}
                    >
                      {/* Color swatch / picker trigger */}
                      <label
                        htmlFor={key}
                        style={{
                          width: 44, height: 44,
                          borderRadius: 10,
                          background: colors[key],
                          border: "2px solid rgba(0,0,0,0.08)",
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: `0 2px 8px ${colors[key]}55`,
                          overflow: "hidden",
                          position: "relative",
                          transition: "box-shadow .2s",
                        }}
                        title={`Edit ${label}`}
                      >
                        <input
                          id={key}
                          type="color"
                          value={colors[key]}
                          onChange={(e) => updateColor(key, e.target.value)}
                          style={{
                            position: "absolute", inset: 0,
                            width: "200%", height: "200%",
                            opacity: 0, cursor: "pointer", border: "none",
                          }}
                        />
                      </label>

                      {/* Hex text input */}
                      <input
                        type="text"
                        value={colors[key]}
                        maxLength={7}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^#[0-9a-fA-F]{0,6}$/.test(v)) updateColor(key, v);
                        }}
                        style={{
                          width: 86, padding: "6px 10px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 7, fontSize: 13,
                          fontFamily: "monospace",
                          color: "#111827",
                          background: "#fff",
                        }}
                      />

                      {/* Label */}
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{label}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{hint}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save */}
                <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    disabled={isSaving}
                    style={{
                      padding: "10px 28px",
                      borderRadius: 10,
                      background: isSaving ? "#d1fae5" : savedOk ? "#059669" : "#008060",
                      color: "#fff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: isSaving ? "default" : "pointer",
                      display: "flex", alignItems: "center", gap: 7,
                      boxShadow: isSaving ? "none" : "0 2px 8px rgba(0,128,96,0.30)",
                      transition: "background .2s, box-shadow .2s",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {isSaving ? (
                      <>⏳ Saving…</>
                    ) : savedOk ? (
                      <><Check size={15} /> Saved!</>
                    ) : (
                      <>Save Colors</>
                    )}
                  </button>
                </div>
              </div>
            </Form>
          </div>

          {/* ── Right: sticky live preview ── */}
          <div style={{ position: "sticky", top: 20 }}>
            <div style={{
              background: "#fff",
              borderRadius: 16,
              padding: "20px 20px 24px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
              border: "1px solid #f3f4f6",
            }}>
              <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: "#111827" }}>
                Live Preview
              </h3>
              <LivePreview colors={colors} />
              <p style={{ margin: "16px 0 0", fontSize: 11, color: "#d1d5db", textAlign: "center" }}>
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
