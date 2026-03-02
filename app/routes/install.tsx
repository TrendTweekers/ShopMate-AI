import { useState, useEffect } from "react";

// ─── Public install landing page — NO Shopify auth required ──────────────────
export default function InstallPage() {
  const [store, setStore] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    window.umami?.track("install_page_view");
  }, []);

  function handleInstall() {
    const slug = store.trim().replace(/\.myshopify\.com\s*$/i, "").trim();
    if (!slug) {
      setError("Please enter your store name.");
      return;
    }
    if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
      setError("Store name can only contain letters, numbers, and hyphens.");
      return;
    }
    setError("");
    window.umami?.track("install_button_click", { shop: slug });
    const shop = `${slug}.myshopify.com`;
    const clientId = "9b1e966350cee0ffb9d2b6f46719da03";
    const scopes = "write_products,read_orders";
    const redirectUri = "https://shopmate-ai-helper-production.up.railway.app/auth/callback";
    window.location.href = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleInstall();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "24px",
      }}
    >
      {/* Card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 4px 40px rgba(0,0,0,0.08)",
          padding: "48px 40px",
          width: "100%",
          maxWidth: 460,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
        }}
      >
        {/* Logo */}
        <img
          src="/assets/shopmatelogo.png"
          alt="ShopMate AI"
          style={{
            height: 72,
            width: "auto",
            objectFit: "contain",
            marginBottom: 16,
          }}
        />

        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 26,
            fontWeight: 800,
            color: "#111827",
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          ShopMate AI
        </h1>
        <p
          style={{
            margin: "0 0 36px",
            fontSize: 15,
            color: "#6b7280",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Your AI-powered customer support assistant for Shopify
        </p>

        {/* Store input */}
        <div style={{ width: "100%", marginBottom: 8 }}>
          <label
            htmlFor="store-input"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            Enter your Shopify store name
          </label>

          {/* Input + suffix row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: error ? "1.5px solid #ef4444" : "1.5px solid #d1d5db",
              borderRadius: 10,
              overflow: "hidden",
              background: "#fff",
              transition: "border-color 0.2s",
            }}
            onFocus={() => {}}
          >
            <input
              id="store-input"
              type="text"
              value={store}
              onChange={(e) => { setStore(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="your-store"
              autoComplete="off"
              autoFocus
              style={{
                flex: 1,
                padding: "12px 14px",
                border: "none",
                outline: "none",
                fontSize: 15,
                color: "#111827",
                background: "transparent",
                fontFamily: "inherit",
              }}
            />
            <span
              style={{
                padding: "12px 14px 12px 0",
                fontSize: 14,
                color: "#9ca3af",
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
            >
              .myshopify.com
            </span>
          </div>

          {error && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>
              {error}
            </p>
          )}
        </div>

        {/* Install button */}
        <button
          onClick={handleInstall}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #008060 0%, #006048 100%)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            marginTop: 8,
            letterSpacing: "0.01em",
            boxShadow: "0 4px 14px rgba(0,128,96,0.35)",
            transition: "opacity 0.15s, transform 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.92"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          Install App →
        </button>

        {/* Trust badges */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            gap: 20,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {["🔒 Secure OAuth", "⚡ 2-min setup", "🆓 Free to start"].map((badge) => (
            <span
              key={badge}
              style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p style={{ marginTop: 24, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
        By installing, you agree to our{" "}
        <a href="#" style={{ color: "#008060", textDecoration: "none" }}>Terms of Service</a>
        {" & "}
        <a href="#" style={{ color: "#008060", textDecoration: "none" }}>Privacy Policy</a>
      </p>

      {/* Dashboard preview */}
      <div style={{ marginTop: 48, width: "100%", maxWidth: 860, textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginBottom: 16, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          What you'll get
        </p>
        <img
          src="/assets/dashboard.JPG"
          alt="ShopMate AI dashboard preview"
          style={{
            width: "100%",
            borderRadius: 16,
            boxShadow: "0 8px 48px rgba(0,0,0,0.14)",
            border: "1px solid #e5e7eb",
          }}
        />
      </div>
    </div>
  );
}
