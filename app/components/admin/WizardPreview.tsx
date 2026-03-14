/**
 * WizardPreview — static, iframe-safe preview of the chat widget.
 *
 * Used ONLY inside the setup wizard's Live Preview panel.
 * No API calls, no framer-motion, no dynamic JS — just a pixel-perfect
 * static render of whatever the merchant has typed so far.
 */

import { Package, Sparkles, RotateCcw, MessageCircle, Send } from "lucide-react";

const ACTION_ICONS: Record<string, React.ElementType> = {
  "Track my order":          Package,
  "Product recommendations": Sparkles,
  "Returns & exchanges":     RotateCcw,
};

interface WizardPreviewProps {
  botName: string;
  greeting: string;
  quickActions: string[];
}

export default function WizardPreview({ botName, greeting, quickActions }: WizardPreviewProps) {
  const initials = botName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SM";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: "#fff",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1.5px solid #e5e7eb",
        boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          background: "#008060",
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Avatar */}
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{initials}</span>
          </div>
          {/* Name + subtitle */}
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
              {botName || "ShopMate AI"}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.75)", lineHeight: 1.2 }}>
              Shop Assistant
            </p>
          </div>
        </div>
        {/* Close × */}
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "default",
          }}
        >
          <span style={{ color: "#fff", fontSize: 13, lineHeight: 1, fontWeight: 400 }}>×</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          backgroundColor: "#f9fafb",
        }}
      >
        {/* Greeting bubble */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
            {greeting || "Hi! 👋 How can I help you today?"}
          </p>
        </div>

        {/* Quick actions label */}
        <p
          style={{
            margin: 0,
            fontSize: 10,
            fontWeight: 600,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Quick Actions
        </p>

        {/* Quick action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {quickActions.length > 0
            ? quickActions.map((label) => {
                const Icon = ACTION_ICONS[label] ?? MessageCircle;
                return (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 11px",
                      borderRadius: 9,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      cursor: "default",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: "#f0fdf4",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={14} color="#008060" />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>{label}</span>
                  </div>
                );
              })
            : (
              <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
                No quick actions selected yet.
              </p>
            )}
        </div>
      </div>

      {/* ── Input bar ── */}
      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid #e5e7eb",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 34,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "#f9fafb",
            display: "flex",
            alignItems: "center",
            paddingLeft: 10,
          }}
        >
          <span style={{ fontSize: 11, color: "#9ca3af" }}>Type a message...</span>
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "#008060",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Send size={14} color="#fff" />
        </div>
      </div>
    </div>
  );
}
