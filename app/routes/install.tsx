import { useMemo, useState } from "react";
import type { LinksFunction, MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  const title = "ShopMate AI — Shopify chat that knows your catalog + tracks orders";
  const description =
    "ShopMate AI answers customer questions 24/7 using your Shopify products, policies, and order data — with a revenue & deflection dashboard.";
  const ogImage = "/og-install.png";

  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "index,follow" },

    // OpenGraph
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:image", content: ogImage },

    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
  ];
};

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap",
  },
];

const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --green: #16a34a;
    --green-dark: #15803d;
    --green-light: #dcfce7;
    --green-mid: #22c55e;
    --black: #0a0a0a;
    --gray: #6b7280;
    --gray-light: #f9fafb;
    --white: #ffffff;
    --border: rgba(0,0,0,0.08);
  }

  html { scroll-behavior: smooth; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--white);
    color: var(--black);
    overflow-x: hidden;
  }

  .sm-container { max-width: 1100px; margin: 0 auto; }

  /* NAV */
  .sm-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    padding: 18px 40px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .sm-nav-logo {
    display: flex; align-items: center; gap: 10px;
    font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.1rem;
    text-decoration: none; color: var(--black);
  }
  .sm-nav-logo-icon {
    width: 36px; height: 36px; background: var(--green);
    border-radius: 10px; display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: white;
    box-shadow: 0 10px 30px rgba(22,163,74,0.22);
  }
  .sm-nav-links { display: flex; align-items: center; gap: 18px; }
  .sm-nav-links a {
    font-size: 0.9rem; color: #374151; text-decoration: none;
  }
  .sm-nav-links a:hover { color: var(--black); }
  .sm-nav-cta {
    background: var(--green); color: white;
    padding: 10px 20px; border-radius: 100px;
    font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.9rem;
    text-decoration: none; transition: all 0.18s;
  }
  .sm-nav-cta:hover { background: var(--green-dark); transform: translateY(-1px); }

  /* HERO */
  .sm-hero {
    min-height: 92vh;
    padding: 120px 40px 70px;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .sm-hero-bg {
    position: absolute; inset: 0; z-index: 0;
    background: radial-gradient(ellipse 85% 65% at 50% 0%, #dcfce7 0%, transparent 72%);
  }
  .sm-hero-dots {
    position: absolute; inset: 0; z-index: 0;
    background-image: radial-gradient(circle, #d1d5db 1px, transparent 1px);
    background-size: 32px 32px;
    opacity: 0.35;
  }
  .sm-hero-inner {
    position: relative; z-index: 1;
    max-width: 1100px; width: 100%;
    display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 48px; align-items: center;
  }
  .sm-hero-badge {
    display: inline-flex; align-items: center; gap: 10px;
    background: rgba(22,163,74,0.08); color: var(--green-dark);
    padding: 7px 14px; border-radius: 100px;
    font-size: 0.82rem; font-weight: 600; margin-bottom: 22px;
    border: 1px solid rgba(22,163,74,0.2);
  }
  .sm-h1 {
    font-family: 'Syne', sans-serif; font-weight: 800;
    font-size: clamp(2.1rem, 3.6vw, 3.1rem);
    line-height: 1.06; letter-spacing: -0.02em; margin-bottom: 18px;
  }
  .sm-h1 em { color: var(--green); font-style: normal; }
  .sm-hero-sub {
    font-size: 1.08rem; color: #4b5563; line-height: 1.65;
    margin-bottom: 28px; max-width: 560px;
  }
  .sm-hero-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .sm-btn-primary {
    background: var(--green); color: white;
    padding: 14px 28px; border-radius: 100px;
    font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1rem;
    text-decoration: none; transition: all 0.18s;
    display: inline-flex; align-items: center; gap: 8px;
    box-shadow: 0 10px 30px rgba(22,163,74,0.25);
  }
  .sm-btn-primary:hover { background: var(--green-dark); transform: translateY(-2px); }
  .sm-btn-secondary {
    background: white; color: #111827;
    padding: 14px 22px; border-radius: 100px;
    font-family: 'Syne', sans-serif; font-weight: 800; font-size: 0.95rem;
    text-decoration: none; transition: all 0.18s;
    border: 1px solid var(--border);
  }
  .sm-btn-secondary:hover { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(0,0,0,0.08); }

  .sm-trust-row {
    display: flex; flex-wrap: wrap; gap: 10px 14px;
    margin-top: 18px;
    color: #6b7280; font-size: 0.86rem;
  }
  .sm-trust-pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    border: 1px solid rgba(0,0,0,0.06);
    border-radius: 999px;
    background: rgba(255,255,255,0.7);
  }
  .sm-check {
    width: 16px; height: 16px; border-radius: 4px;
    background: rgba(22,163,74,0.12);
    display: flex; align-items: center; justify-content: center;
    color: var(--green-dark);
    font-weight: 900;
    font-size: 12px;
  }

  /* WIDGET MOCKUP */
  .sm-widget-mockup {
    background: white;
    border-radius: 20px;
    box-shadow: 0 25px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06);
    overflow: hidden;
    animation: sm-float 4s ease-in-out infinite;
    max-width: 340px; margin-left: auto;
  }
  @keyframes sm-float { 0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)} }
  .sm-widget-header {
    background: var(--green); padding: 16px 18px;
    display: flex; align-items: center; gap: 12px;
  }
  .sm-widget-avatar {
    width: 38px; height: 38px; background: rgba(255,255,255,0.2);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-family: 'Syne', sans-serif; font-weight: 900; color: white; font-size: 0.85rem;
  }
  .sm-widget-header-info { flex: 1; }
  .sm-widget-header-info strong { display: block; color: white; font-family: 'Syne', sans-serif; font-size: 0.95rem; }
  .sm-widget-header-info span { color: rgba(255,255,255,0.8); font-size: 0.78rem; }
  .sm-widget-body { padding: 18px; background: #f8fafc; }
  .sm-widget-msg {
    background: white; border-radius: 14px 14px 14px 4px;
    padding: 12px 14px; font-size: 0.88rem; color: #374151;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 14px;
    max-width: 92%; display: inline-block;
  }
  .sm-widget-label { font-size: 0.68rem; font-weight: 800; color: #9ca3af; letter-spacing: 0.08em; text-transform: uppercase; margin: 10px 0; }
  .sm-widget-action {
    background: white; border: 1px solid #e5e7eb;
    border-radius: 12px; padding: 12px 14px;
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 8px; cursor: default;
    font-size: 0.88rem; color: #111827;
  }
  .sm-widget-action-icon {
    width: 32px; height: 32px; background: rgba(22,163,74,0.12);
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0; color: var(--green-dark);
    font-weight: 900;
  }
  .sm-widget-input-row {
    display: flex; align-items: center; gap: 10px;
    margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;
  }
  .sm-widget-input {
    flex: 1; background: white; border: 1px solid #e5e7eb;
    border-radius: 100px; padding: 10px 14px; font-size: 0.85rem; color: #6b7280;
  }
  .sm-widget-send {
    width: 36px; height: 36px; background: var(--green);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  /* STATS BAR */
  .sm-stats-bar {
    background: var(--black); padding: 26px 40px;
    display: flex; justify-content: center; gap: 56px; flex-wrap: wrap;
  }
  .sm-stat { text-align: center; }
  .sm-stat-num {
    font-family: 'Syne', sans-serif; font-weight: 900; font-size: 1.85rem; color: white;
    display: block;
  }
  .sm-stat-num span { color: var(--green-mid); }
  .sm-stat-label { font-size: 0.82rem; color: #9ca3af; margin-top: 4px; }

  /* SECTIONS */
  .sm-section { padding: 96px 40px; }
  .sm-section-label {
    font-size: 0.78rem; font-weight: 900; color: var(--green);
    text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;
  }
  .sm-section-title {
    font-family: 'Syne', sans-serif; font-weight: 900;
    font-size: clamp(1.9rem, 3vw, 2.7rem); line-height: 1.12;
    letter-spacing: -0.02em; margin-bottom: 54px; max-width: 680px;
  }

  /* FEATURES */
  .sm-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
  .sm-feature-card {
    background: var(--gray-light); border-radius: 20px; padding: 28px;
    border: 1px solid rgba(0,0,0,0.06); transition: all 0.18s;
  }
  .sm-feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.08); }
  .sm-feature-icon {
    width: 52px; height: 52px; background: rgba(22,163,74,0.12);
    border-radius: 14px; display: flex; align-items: center; justify-content: center;
    font-size: 18px; margin-bottom: 18px; color: var(--green-dark); font-weight: 900;
  }
  .sm-feature-card h3 {
    font-family: 'Syne', sans-serif; font-weight: 900; font-size: 1.05rem;
    margin-bottom: 10px;
  }
  .sm-feature-card p { font-size: 0.92rem; color: #6b7280; line-height: 1.6; }

  /* TESTIMONIALS */
  .sm-testimonials { background: white; }
  .sm-test-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
  .sm-quote {
    border: 1px solid var(--border);
    background: #fff;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 14px 40px rgba(0,0,0,0.05);
  }
  .sm-quote p { color: #111827; line-height: 1.6; font-size: 0.95rem; }
  .sm-quote .sm-quote-meta { margin-top: 14px; color: #6b7280; font-size: 0.86rem; }
  .sm-quote .sm-quote-meta strong { color: #111827; }

  /* PRICING */
  .sm-pricing { background: var(--gray-light); }
  .sm-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .sm-plan {
    border: 1px solid var(--border);
    border-radius: 22px;
    background: white;
    padding: 28px;
    box-shadow: 0 16px 45px rgba(0,0,0,0.06);
  }
  .sm-plan.featured {
    border-color: rgba(22,163,74,0.35);
    box-shadow: 0 20px 60px rgba(22,163,74,0.12);
  }
  .sm-plan h3 { font-family: 'Syne', sans-serif; font-weight: 900; font-size: 1.2rem; margin-bottom: 8px; }
  .sm-price { font-family: 'Syne', sans-serif; font-weight: 900; font-size: 2rem; margin: 10px 0 14px; }
  .sm-price small { font-size: 0.95rem; color: #6b7280; font-weight: 800; }
  .sm-ul { list-style: none; display: grid; gap: 10px; margin-top: 10px; }
  .sm-ul li { display: flex; gap: 10px; align-items: flex-start; color: #374151; line-height: 1.45; }
  .sm-ul li span {
    width: 18px; height: 18px; border-radius: 6px;
    background: rgba(22,163,74,0.12);
    display: flex; align-items: center; justify-content: center;
    color: var(--green-dark);
    font-weight: 900;
    flex-shrink: 0;
    margin-top: 2px;
    font-size: 12px;
  }

  /* HOW */
  .sm-how { background: #fff; }
  .sm-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 36px; margin-top: 20px; }
  .sm-step-num {
    font-family: 'Syne', sans-serif; font-weight: 900; font-size: 2.6rem;
    color: rgba(22,163,74,0.14); line-height: 1; margin-bottom: 12px;
  }
  .sm-step h3 { font-family: 'Syne', sans-serif; font-weight: 900; font-size: 1.1rem; margin-bottom: 8px; }
  .sm-step p { font-size: 0.95rem; color: #6b7280; line-height: 1.6; }

  /* INSTALL */
  .sm-install-section {
    padding: 96px 40px;
    background: var(--black);
    position: relative; overflow: hidden;
  }
  .sm-install-glow {
    position: absolute; top: -100px; left: 50%; transform: translateX(-50%);
    width: 700px; height: 420px;
    background: radial-gradient(ellipse, rgba(22,163,74,0.32) 0%, transparent 70%);
    pointer-events: none;
  }
  .sm-install-inner { max-width: 620px; margin: 0 auto; text-align: center; position: relative; z-index: 1; }
  .sm-install-inner h2 {
    font-family: 'Syne', sans-serif; font-weight: 900;
    font-size: clamp(2rem, 4vw, 2.8rem); color: white;
    line-height: 1.12; letter-spacing: -0.02em; margin-bottom: 14px;
  }
  .sm-install-inner h2 em { color: var(--green-mid); font-style: normal; }
  .sm-install-inner > p { color: #9ca3af; font-size: 1rem; margin-bottom: 26px; line-height: 1.6; }

  .sm-install-features { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
  .sm-install-feat { color: #9ca3af; font-size: 0.88rem; display: flex; align-items: center; gap: 8px; }
  .sm-install-feat .sm-check { background: rgba(34,197,94,0.18); color: #bbf7d0; }

  .sm-install-box {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 22px; padding: 26px;
  }

  .sm-help {
    text-align: left;
    margin-bottom: 10px;
    color: #9ca3af;
    font-size: 0.9rem;
  }
  .sm-help strong { color: white; }

  .sm-install-input-row {
    display: flex; gap: 0;
    border: 1px solid rgba(255,255,255,0.18); border-radius: 14px; overflow: hidden;
    background: rgba(255,255,255,0.06);
  }
  .sm-install-input-row.error { border-color: #ef4444; }
  .sm-install-input {
    flex: 1; background: transparent; border: none; outline: none;
    padding: 14px 16px; font-size: 1rem; color: white;
    font-family: 'DM Sans', sans-serif;
  }
  .sm-install-input::placeholder { color: #6b7280; }
  .sm-install-suffix {
    padding: 14px 16px; color: #9ca3af; font-size: 1rem;
    border-left: 1px solid rgba(255,255,255,0.12); white-space: nowrap;
    display: flex; align-items: center;
  }

  .sm-error-text {
    text-align: left;
    margin-top: 10px;
    color: #fecaca;
    font-size: 0.9rem;
  }

  .sm-install-btn {
    width: 100%; background: var(--green); color: white; border: none;
    padding: 16px; border-radius: 14px; cursor: pointer;
    font-family: 'Syne', sans-serif; font-weight: 900; font-size: 1.05rem;
    transition: all 0.18s; display: flex; align-items: center; justify-content: center; gap: 8px;
    margin-top: 14px;
  }
  .sm-install-btn:hover:not(:disabled) { background: var(--green-dark); transform: translateY(-2px); }
  .sm-install-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .sm-install-note { color: #9ca3af; font-size: 0.82rem; margin-top: 14px; line-height: 1.6; }
  .sm-install-note a { color: #d1d5db; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.2); }
  .sm-install-note a:hover { color: white; border-bottom-color: rgba(255,255,255,0.55); }

  /* FOOTER */
  .sm-footer { background: #0f0f0f; padding: 22px 40px; text-align: center; color: #6b7280; font-size: 0.85rem; }
  .sm-footer a { color: #9ca3af; text-decoration: none; }
  .sm-footer a:hover { color: white; }

  /* RESPONSIVE */
  @media (max-width: 900px) {
    .sm-hero-inner { grid-template-columns: 1fr; gap: 36px; }
    .sm-widget-mockup { max-width: 360px; margin: 0 auto; }
    .sm-features-grid { grid-template-columns: 1fr; }
    .sm-test-grid { grid-template-columns: 1fr; }
    .sm-pricing-grid { grid-template-columns: 1fr; }
    .sm-steps { grid-template-columns: 1fr; }
  }
  @media (max-width: 768px) {
    .sm-nav { padding: 14px 18px; }
    .sm-nav-links { display: none; }
    .sm-hero { padding: 108px 18px 50px; }
    .sm-section { padding: 70px 18px; }
    .sm-stats-bar { gap: 26px; padding: 22px 18px; }
    .sm-install-section { padding: 70px 18px; }
  }
`;

function sanitizeShopSlug(input: string) {
  const trimmed = input.trim();

  // Accept:
  // - "your-store"
  // - "your-store.myshopify.com"
  // - "https://admin.shopify.com/store/your-store"
  // - "https://your-store.myshopify.com"
  let slug = trimmed;

  // admin URL pattern
  const adminMatch = slug.match(/admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/i);
  if (adminMatch?.[1]) slug = adminMatch[1];

  // remove protocol + path
  slug = slug.replace(/^https?:\/\//i, "");
  slug = slug.replace(/\/.*$/i, "");

  // remove myshopify.com suffix
  slug = slug.replace(/\.myshopify\.com$/i, "");

  // keep only allowed chars
  slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  slug = slug.replace(/^-+/, "").replace(/-+$/, "");

  // must start with alnum
  if (!slug.match(/^[a-z0-9][a-z0-9-]*$/)) return "";
  return slug;
}

export default function InstallPage() {
  const [shop, setShop] = useState("");
  const [error, setError] = useState<string | null>(null);

  const installUrl = useMemo(() => {
    const slug = sanitizeShopSlug(shop);
    if (!slug) return "";
    return `https://shopmate-ai-helper-production.up.railway.app/auth?shop=${slug}.myshopify.com`;
  }, [shop]);

  function handleInstall() {
    const slug = sanitizeShopSlug(shop);
    if (!slug) {
      setError("Please enter your Shopify store domain (example: cool-socks).");
      return;
    }
    setError(null);
    window.location.href = `https://shopmate-ai-helper-production.up.railway.app/auth?shop=${slug}.myshopify.com`;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <nav className="sm-nav">
        <a className="sm-nav-logo" href="#top" aria-label="ShopMate AI">
          <div className="sm-nav-logo-icon">SM</div>
          ShopMate AI
        </a>

        <div className="sm-nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#install">Install</a>
        </div>

        <a href="#install" className="sm-nav-cta">
          Install →
        </a>
      </nav>

      {/* HERO */}
      <section className="sm-hero" id="top">
        <div className="sm-hero-bg" />
        <div className="sm-hero-dots" />
        <div className="sm-hero-inner">
          <div>
            <div className="sm-hero-badge">Built for Shopify stores • Secure OAuth install</div>

            <h1 className="sm-h1">
              AI chat that <em>knows your catalog</em> — and tracks orders automatically
            </h1>

            <p className="sm-hero-sub">
              ShopMate AI answers common questions instantly (orders, products, policies) and shows what it's saving you
              — and earning you — in a simple dashboard.
            </p>

            <div className="sm-hero-actions">
              <a href="#install" className="sm-btn-primary">
                Install free
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>

              <a href="#pricing" className="sm-btn-secondary">
                See pricing
              </a>
            </div>

            <div className="sm-trust-row" aria-label="Trust features">
              <div className="sm-trust-pill">
                <div className="sm-check">✓</div> Uses real Shopify products & orders
              </div>
              <div className="sm-trust-pill">
                <div className="sm-check">✓</div> Policies imported automatically
              </div>
              <div className="sm-trust-pill">
                <div className="sm-check">✓</div> Revenue + deflection dashboard
              </div>
            </div>
          </div>

          {/* WIDGET MOCKUP */}
          <div className="sm-widget-mockup" aria-label="Chat widget mockup">
            <div className="sm-widget-header">
              <div className="sm-widget-avatar">SM</div>
              <div className="sm-widget-header-info">
                <strong>ShopMate AI</strong>
                <span>Shop assistant • Online</span>
              </div>
            </div>
            <div className="sm-widget-body">
              <div className="sm-widget-msg">
                Hi — I can track orders, suggest products, and answer policy questions. What do you need?
              </div>

              <div className="sm-widget-label">Example questions</div>

              <div className="sm-widget-action">
                <div className="sm-widget-action-icon">1</div>
                Track order 5050
              </div>
              <div className="sm-widget-action">
                <div className="sm-widget-action-icon">2</div>
                Best sellers under $50
              </div>
              <div className="sm-widget-action">
                <div className="sm-widget-action-icon">3</div>
                What is your return policy?
              </div>

              <div className="sm-widget-input-row">
                <div className="sm-widget-input">Type a message…</div>
                <div className="sm-widget-send">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <div className="sm-stats-bar" aria-label="Value highlights">
        <div className="sm-stat">
          <span className="sm-stat-num">
            <span>24/7</span>
          </span>
          <div className="sm-stat-label">Instant answers</div>
        </div>
        <div className="sm-stat">
          <span className="sm-stat-num">
            <span>2</span> min
          </span>
          <div className="sm-stat-label">Setup time</div>
        </div>
        <div className="sm-stat">
          <span className="sm-stat-num">
            <span>Free</span>
          </span>
          <div className="sm-stat-label">Plan available</div>
        </div>
        <div className="sm-stat">
          <span className="sm-stat-num">
            <span>$</span> attribution
          </span>
          <div className="sm-stat-label">Revenue dashboard</div>
        </div>
      </div>

      {/* FEATURES */}
      <section className="sm-section" id="features">
        <div className="sm-container">
          <div className="sm-section-label">Features</div>
          <h2 className="sm-section-title">Everything your store needs — handled automatically</h2>

          <div className="sm-features-grid">
            {[
              {
                icon: "OT",
                title: "Order tracking",
                desc: 'Customers ask "where is my order?" and get instant answers with live order context.',
              },
              {
                icon: "PR",
                title: "Product recommendations",
                desc: "Uses your Shopify catalog to recommend relevant products and improve AOV.",
              },
              {
                icon: "KB",
                title: "Policies + FAQs",
                desc: "Answers shipping/returns questions using your policies — auto-imported from Shopify.",
              },
              {
                icon: "ES",
                title: "Human escalation",
                desc: "When AI can't help, handoff is clean and includes the conversation context.",
              },
              {
                icon: "AN",
                title: "Analytics dashboard",
                desc: "Track chats, top questions, deflection, and revenue attribution in one place.",
              },
              {
                icon: "IN",
                title: "Instant install",
                desc: "Secure OAuth install. Works without theme edits. Enable the widget in minutes.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="sm-feature-card">
                <div className="sm-feature-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="sm-section sm-testimonials">
        <div className="sm-container">
          <div className="sm-section-label">Proof</div>
          <h2 className="sm-section-title">Early feedback from beta users</h2>

          <div className="sm-test-grid">
            {[
              {
                quote:
                  "Order tracking questions dropped immediately. Customers stopped emailing us for basic updates.",
                meta: "Beta merchant • Apparel store",
              },
              {
                quote:
                  "The recommendations are surprisingly relevant. We can finally see which chats drive clicks and purchases.",
                meta: "Beta merchant • Beauty store",
              },
              {
                quote:
                  "Setup took minutes. The dashboard is what sold us — it's not just a chatbot, it shows impact.",
                meta: "Beta merchant • Home goods",
              },
            ].map((t) => (
              <div key={t.meta} className="sm-quote">
                <p>"{t.quote}"</p>
                <div className="sm-quote-meta">
                  <strong>{t.meta}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="sm-section sm-pricing" id="pricing">
        <div className="sm-container">
          <div className="sm-section-label">Pricing</div>
          <h2 className="sm-section-title">Start free. Upgrade when you're ready.</h2>

          <div className="sm-pricing-grid">
            <div className="sm-plan">
              <h3>Free</h3>
              <div className="sm-price">
                $0 <small>/ month</small>
              </div>
              <ul className="sm-ul">
                <li>
                  <span>✓</span> 50 messages / month
                </li>
                <li>
                  <span>✓</span> Order tracking + catalog recommendations
                </li>
                <li>
                  <span>✓</span> Policies + FAQ answers
                </li>
                <li>
                  <span>✓</span> Basic analytics + revenue attribution
                </li>
              </ul>
            </div>

            <div className="sm-plan featured">
              <h3>Pro</h3>
              <div className="sm-price">
                $39 <small>/ month</small>
              </div>
              <ul className="sm-ul">
                <li>
                  <span>✓</span> Unlimited messages
                </li>
                <li>
                  <span>✓</span> Advanced analytics dashboard
                </li>
                <li>
                  <span>✓</span> Priority support
                </li>
                <li>
                  <span>✓</span> Everything in Free
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="sm-section sm-how">
        <div className="sm-container">
          <div className="sm-section-label">How it works</div>
          <h2 className="sm-section-title">Live in 3 steps</h2>

          <div className="sm-steps">
            <div className="sm-step">
              <div className="sm-step-num">01</div>
              <h3>Install via Shopify</h3>
              <p>Secure OAuth install. ShopMate connects to your store using Shopify permissions.</p>
            </div>
            <div className="sm-step">
              <div className="sm-step-num">02</div>
              <h3>Enable the widget</h3>
              <p>Turn on the chat widget and import policies. ShopMate can now answer real store questions.</p>
            </div>
            <div className="sm-step">
              <div className="sm-step-num">03</div>
              <h3>Track outcomes</h3>
              <p>See chat volume, deflection, and revenue attribution in your dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALL SECTION */}
      <section className="sm-install-section" id="install">
        <div className="sm-install-glow" />
        <div className="sm-install-inner">
          <h2>
            Install in <em>2 minutes</em>
          </h2>
          <p>Enter your Shopify store name (the one in your admin URL), then complete the Shopify install flow.</p>

          <div className="sm-install-features">
            {["No credit card", "Secure OAuth", "Cancel anytime", "Built for Shopify"].map((feat) => (
              <div key={feat} className="sm-install-feat">
                <div className="sm-check">✓</div>
                {feat}
              </div>
            ))}
          </div>

          <div className="sm-install-box">
            <div className="sm-help">
              Example: if your admin URL is <strong>admin.shopify.com/store/cool-socks</strong>, enter{" "}
              <strong>cool-socks</strong>.
            </div>

            <div className={`sm-install-input-row${error ? " error" : ""}`}>
              <input
                className="sm-install-input"
                type="text"
                placeholder="your-store-name"
                autoComplete="off"
                spellCheck={false}
                value={shop}
                onChange={(e) => {
                  setShop(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleInstall()}
              />
              <div className="sm-install-suffix">.myshopify.com</div>
            </div>

            {error ? <div className="sm-error-text">{error}</div> : null}

            <button className="sm-install-btn" onClick={handleInstall} disabled={!shop.trim()}>
              Continue to Shopify Install
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>

            <div className="sm-install-note">
              By installing, you agree to our <a href="/terms">Terms of Service</a> and{" "}
              <a href="/privacy">Privacy Policy</a>.
            </div>

            {installUrl ? (
              <div className="sm-install-note" style={{ marginTop: 10 }}>
                Install URL preview: <span style={{ color: "white" }}>{installUrl}</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="sm-footer">
        <p>
          © 2026 ShopMate AI · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · Support:{" "}
          <a href="mailto:admin@stackedboost.com">admin@stackedboost.com</a>
        </p>
      </footer>
    </>
  );
}
