/**
 * Customize page — Widget Theme & Appearance
 *
 * Lets merchants browse 5 pre-built color themes and copy hex values
 * to paste into the Shopify Theme Editor's color picker.
 * Also provides a quick-reply chip editor with a live preview.
 *
 * No DB storage: colors live in the Shopify block schema (Theme Editor).
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useState } from "react";
import { Palette, Copy, Check, ExternalLink, MessageSquare } from "lucide-react";
import { authenticate } from "../shopify.server";
import AdminLayout from "~/components/admin/AdminLayout";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // ── Update last active timestamp ──
  await prisma.shopSettings.upsert({
    where: { shop: session.shop },
    create: { shop: session.shop, lastActiveAt: new Date() },
    update: { lastActiveAt: new Date() },
  });

  return { shop: session.shop };
};

// ─── Preset theme data ────────────────────────────────────────────────────────

const PRESETS = [
  {
    id: "modern-green",
    name: "Modern Green",
    primary: "#10b981",
    accent: "#059669",
    description: "Fresh & vibrant — the ShopMate default",
  },
  {
    id: "professional-blue",
    name: "Professional Blue",
    primary: "#3b82f6",
    accent: "#2563eb",
    description: "Clean and trustworthy",
  },
  {
    id: "premium-purple",
    name: "Premium Purple",
    primary: "#8b5cf6",
    accent: "#7c3aed",
    description: "Luxurious and bold",
  },
  {
    id: "minimalist-gray",
    name: "Minimalist Gray",
    primary: "#6b7280",
    accent: "#4b5563",
    description: "Subtle and elegant",
  },
  {
    id: "warm-orange",
    name: "Warm Orange",
    primary: "#f97316",
    accent: "#ea580c",
    description: "Energetic and inviting",
  },
] as const;

const DEFAULT_QUICK_REPLIES =
  "Track my order,Recommend a product,What's your return policy?,Talk to a human";

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomizePage() {
  const { shop } = useLoaderData<typeof loader>();

  // Which preset swatch is expanded (shows hex values below the grid)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Tracks which specific copy button was last pressed:
  // e.g. "modern-green-primary" | "modern-green-accent" | "quick-replies"
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Quick-reply chips — editable, live preview
  const [quickReplies, setQuickReplies] = useState(DEFAULT_QUICK_REPLIES);
  const [qrCopied, setQrCopied] = useState(false);

  const selectedPreset = PRESETS.find((p) => p.id === selectedId) ?? null;

  // Active primary colour for the live widget preview bubble
  const previewColor = selectedPreset?.primary ?? "#008060";

  // ── Clipboard helper ──────────────────────────────────────────────────────
  function copyValue(text: string, key: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
      })
      .catch(() => {
        // Fallback for browsers without clipboard API (unlikely in Shopify admin)
        try {
          const el = document.createElement("textarea");
          el.value = text;
          el.style.cssText = "position:fixed;opacity:0";
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
          setCopiedKey(key);
          setTimeout(() => setCopiedKey(null), 2000);
        } catch {
          /* silent — nothing more we can do */
        }
      });
  }

  // Live chip list from textarea
  const chips = quickReplies
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Link that opens the Shopify Theme Editor directly on the App Embeds panel.
  // target="_top" breaks out of the Shopify admin iframe.
  const themeEditorUrl = `https://${shop}/admin/themes/current/editor?context=apps`;

  return (
    <AdminLayout>
      <div style={{ maxWidth: 900, margin: "0 auto" }} className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Palette size={22} color="#8b5cf6" />
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
            Customize Widget
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            Choose a colour theme and configure quick-reply chips for your chat widget
          </p>
        </div>
      </div>

      {/* ── SECTION 1: Preset Themes ──────────────────────────────────────── */}
      <div className="polaris-card">
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#111827" }}>
          Preset Colour Themes
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
          Click a theme to reveal its hex values. Copy them into the{" "}
          <strong>Theme Editor → App embeds → ShopMate → Primary colour</strong> field.
        </p>

        {/* Swatch grid */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {PRESETS.map((preset) => {
            const isSelected = selectedId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setSelectedId(isSelected ? null : preset.id)}
                style={{
                  width: 160,
                  padding: 0,
                  border: `2px solid ${isSelected ? preset.primary : "#e5e7eb"}`,
                  borderRadius: 12,
                  background: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color .15s, box-shadow .15s",
                  boxShadow: isSelected
                    ? `0 0 0 3px ${preset.primary}22`
                    : "0 1px 3px rgba(0,0,0,.06)",
                }}
              >
                {/* Split-colour swatch rectangle */}
                <div
                  style={{
                    height: 56,
                    borderRadius: "10px 10px 0 0",
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <div style={{ flex: 1, background: preset.primary }} />
                  <div style={{ flex: 1, background: preset.accent }} />
                </div>
                {/* Name + description */}
                <div style={{ padding: "8px 12px 10px" }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: "#111827",
                      marginBottom: 2,
                    }}
                  >
                    {preset.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    {preset.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Expanded hex values — shown when a preset is selected */}
        {selectedPreset && (
          <div
            style={{
              marginTop: 16,
              padding: "16px 20px",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              alignItems: "center",
            }}
          >
            <span
              style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginRight: 8 }}
            >
              {selectedPreset.name}
            </span>

            {/* Primary */}
            {(["primary", "accent"] as const).map((role) => {
              const hex = selectedPreset[role];
              const key = `${selectedPreset.id}-${role}`;
              const wasCopied = copiedKey === key;
              return (
                <div
                  key={role}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      background: hex,
                      border: "1px solid rgba(0,0,0,.1)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: "#374151" }}>
                    {role === "primary" ? "Primary" : "Accent"}: {hex}
                  </span>
                  <button
                    onClick={() => copyValue(hex, key)}
                    title={wasCopied ? "Copied!" : `Copy ${hex}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      background: wasCopied ? "hsl(160 100% 96%)" : "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 500,
                      color: wasCopied ? "#008060" : "#374151",
                      transition: "background .15s",
                    }}
                  >
                    {wasCopied ? (
                      <><Check size={12} color="#008060" /> Copied</>
                    ) : (
                      <><Copy size={12} /> Copy</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 2: How to Apply ───────────────────────────────────────── */}
      <div className="polaris-card">
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#111827" }}>
          How to Apply a Theme
        </h3>

        {/* Info callout */}
        <div
          style={{
            padding: "10px 14px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            fontSize: 13,
            color: "#1e40af",
            marginBottom: 16,
          }}
        >
          Widget colours are configured in the Shopify Theme Editor — this ensures your
          widget always stays in sync with your live theme settings.
        </div>

        {/* Step list */}
        <ol
          style={{
            margin: "0 0 16px",
            paddingLeft: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {[
            "Click a preset above and press Copy next to the hex value you want",
            'In your Shopify Admin, go to Online Store → Themes → Customize',
            'In the left sidebar, click "App embeds"',
            'Find "ShopMate AI Chat Widget" and click to expand it',
            'Click the "Primary colour" swatch and paste the copied hex value',
            "Click Save — the widget updates immediately on your storefront",
          ].map((step, i) => (
            <li key={i} style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
              {step}
            </li>
          ))}
        </ol>

        {/* Theme Editor deep-link */}
        <a
          href={themeEditorUrl}
          target="_top"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 8,
            background: "#008060",
            color: "#fff",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Open Theme Editor <ExternalLink size={13} />
        </a>
      </div>

      {/* ── SECTION 3: Widget preview ─────────────────────────────────────── */}
      <div className="polaris-card">
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#111827" }}>
          Widget Preview
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>
          A preview of how the widget appears on your storefront. Select a preset above
          to see the colour change on the chat bubble.
        </p>

        <div style={{ display: "flex", justifyContent: "center" }}>
          {/* Phone frame */}
          <div
            style={{
              position: "relative",
              width: 320,
              height: 580,
              borderRadius: 44,
              border: "8px solid rgba(0,0,0,.12)",
              background: "#f9fafb",
              boxShadow: "0 12px 48px rgba(0,0,0,.16)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {/* Status bar */}
            <div
              style={{
                height: 40,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 14,
                  borderRadius: 999,
                  background: "rgba(0,0,0,.08)",
                }}
              />
            </div>

            {/* Mock storefront skeleton */}
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Hero image placeholder */}
              <div
                style={{
                  height: 140,
                  borderRadius: 10,
                  background: "#e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                }}
              >
                🛍️
              </div>
              {/* Product title placeholder */}
              <div style={{ height: 14, width: "70%", borderRadius: 4, background: "#d1d5db" }} />
              <div style={{ height: 14, width: "50%", borderRadius: 4, background: "#e5e7eb" }} />
              {/* Price */}
              <div style={{ height: 18, width: "30%", borderRadius: 4, background: "#d1d5db" }} />
              {/* Button */}
              <div
                style={{
                  height: 38,
                  borderRadius: 8,
                  background: "#111827",
                  marginTop: 4,
                }}
              />
            </div>

            {/* Chat bubble — uses the selected preset colour */}
            <button
              style={{
                position: "absolute",
                bottom: 20,
                right: 18,
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: previewColor,
                border: "none",
                cursor: "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(0,0,0,.22)",
                transition: "background .3s",
              }}
              tabIndex={-1}
              aria-hidden
            >
              <MessageSquare size={22} color="#fff" />
            </button>

            {/* Greeting speech bubble */}
            <div
              style={{
                position: "absolute",
                bottom: 80,
                right: 14,
                maxWidth: 180,
                padding: "8px 12px",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px 12px 4px 12px",
                fontSize: 12,
                color: "#111827",
                lineHeight: 1.4,
                boxShadow: "0 2px 8px rgba(0,0,0,.08)",
              }}
            >
              Hi! 👋 How can I help you today?
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Quick-Reply Chip Editor ───────────────────────────── */}
      <div className="polaris-card">
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#111827" }}>
          Quick-Reply Chips
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6b7280" }}>
          These chips appear below the greeting message until the customer sends their
          first message. Edit them here and copy the value to paste into the Theme Editor.
        </p>

        {/* Editable textarea */}
        <textarea
          value={quickReplies}
          onChange={(e) => setQuickReplies(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: 13,
            padding: "8px 10px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            resize: "vertical",
            boxSizing: "border-box",
            color: "#111827",
          }}
          placeholder="Track my order,Recommend a product,What's your return policy?"
        />

        {/* Live chip preview */}
        {chips.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 10,
              padding: "10px 12px",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 11, color: "#9ca3af", alignSelf: "center", marginRight: 4 }}>
              Preview:
            </span>
            {chips.map((chip, i) => (
              <span
                key={i}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: "1.5px solid #008060",
                  fontSize: 12,
                  color: "#008060",
                  background: "#fff",
                  fontWeight: 500,
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* Copy + guide */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 12,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
            Paste into: <strong>Theme Editor → App embeds → ShopMate → Quick-reply chips</strong>
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(quickReplies).then(() => {
                setQrCopied(true);
                setTimeout(() => setQrCopied(false), 2000);
              });
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: qrCopied ? "hsl(160 100% 96%)" : "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              color: qrCopied ? "#008060" : "#374151",
              transition: "background .15s",
            }}
          >
            {qrCopied ? (
              <><Check size={14} color="#008060" /> Copied!</>
            ) : (
              <><Copy size={14} /> Copy to clipboard</>
            )}
          </button>
        </div>
      </div>

    </div>
    </AdminLayout>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
