import { useState } from "react";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
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
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--white);
    color: var(--black);
    overflow-x: hidden;
  }

  /* NAV */
  .sm-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    padding: 20px 40px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .sm-nav-logo {
    display: flex; align-items: center; gap: 10px;
    font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.2rem;
  }
  .sm-nav-logo-icon {
    width: 36px; height: 36px; background: var(--green);
    border-radius: 10px; display: flex; align-items: center; justify-content: center;
    font-size: 18px;
  }
  .sm-nav-cta {
    background: var(--green); color: white;
    padding: 10px 24px; border-radius: 100px;
    font-family: 'Syne', sans-serif; font-weight: 600; font-size: 0.9rem;
    text-decoration: none; transition: all 0.2s;
  }
  .sm-nav-cta:hover { background: var(--green-dark); transform: translateY(-1px); }

  /* HERO */
  .sm-hero {
    min-height: 100vh;
    padding: 120px 40px 80px;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .sm-hero-bg {
    position: absolute; inset: 0; z-index: 0;
    background: radial-gradient(ellipse 80% 60% at 50% 0%, #dcfce7 0%, transparent 70%);
  }
  .sm-hero-dots {
    position: absolute; inset: 0; z-index: 0;
    background-image: radial-gradient(circle, #d1d5db 1px, transparent 1px);
    background-size: 32px 32px;
    opacity: 0.4;
  }
  .sm-hero-inner {
    position: relative; z-index: 1;
    max-width: 1100px; width: 100%;
    display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;
  }
  .sm-hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--green-light); color: var(--green-dark);
    padding: 6px 16px; border-radius: 100px;
    font-size: 0.8rem; font-weight: 500; margin-bottom: 24px;
    border: 1px solid #bbf7d0;
  }
  .sm-hero-badge span { width: 6px; height: 6px; background: var(--green); border-radius: 50%; animation: sm-pulse 2s infinite; display: inline-block; }
  @keyframes sm-pulse { 0%,100%{opacity:1}50%{opacity:0.4} }

  .sm-h1 {
    font-family: 'Syne', sans-serif; font-weight: 800;
    font-size: clamp(2.4rem, 4vw, 3.4rem); line-height: 1.1;
    letter-spacing: -0.02em; margin-bottom: 20px;
  }
  .sm-h1 em { color: var(--green); font-style: normal; }

  .sm-hero-sub {
    font-size: 1.1rem; color: #4b5563; line-height: 1.65;
    margin-bottom: 36px; max-width: 480px;
  }

  .sm-hero-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

  .sm-btn-primary {
    background: var(--green); color: white;
    padding: 14px 32px; border-radius: 100px;
    font-family: 'Syne', sans-serif; font-weight: 700; font-size: 1rem;
    text-decoration: none; transition: all 0.2s;
    display: inline-flex; align-items: center; gap: 8px;
    box-shadow: 0 4px 20px rgba(22,163,74,0.3);
  }
  .sm-btn-primary:hover { background: var(--green-dark); transform: translateY(-2px); box-shadow: 0 8px 30px rgba(22,163,74,0.4); }

  .sm-hero-trust { font-size: 0.85rem; color: var(--gray); display: flex; align-items: center; gap: 6px; }
  .sm-hero-trust svg { color: #fbbf24; }

  /* WIDGET MOCKUP */
  .sm-widget-mockup {
    background: white;
    border-radius: 20px;
    box-shadow: 0 25px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06);
    overflow: hidden;
    animation: sm-float 4s ease-in-out infinite;
  }
  @keyframes sm-float { 0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)} }

  .sm-widget-header {
    background: var(--green); padding: 16px 20px;
    display: flex; align-items: center; gap: 12px;
  }
  .sm-widget-avatar {
    width: 38px; height: 38px; background: rgba(255,255,255,0.2);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-family: 'Syne', sans-serif; font-weight: 800; color: white; font-size: 0.85rem;
  }
  .sm-widget-header-info { flex: 1; }
  .sm-widget-header-info strong { display: block; color: white; font-family: 'Syne', sans-serif; font-size: 0.95rem; }
  .sm-widget-header-info span { color: rgba(255,255,255,0.8); font-size: 0.78rem; }
  .sm-widget-header-close { color: rgba(255,255,255,0.7); font-size: 18px; cursor: pointer; }

  .sm-widget-body { padding: 20px; background: #f8fafc; }

  .sm-widget-msg {
    background: white; border-radius: 14px 14px 14px 4px;
    padding: 12px 16px; font-size: 0.88rem; color: #374151;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 16px;
    max-width: 85%; display: inline-block;
  }
  .sm-widget-label { font-size: 0.7rem; font-weight: 600; color: #9ca3af; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; }

  .sm-widget-action {
    background: white; border: 1px solid #e5e7eb;
    border-radius: 12px; padding: 12px 16px;
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 8px; cursor: pointer; transition: all 0.15s;
    font-size: 0.88rem; color: #1f2937;
  }
  .sm-widget-action:hover { border-color: var(--green); background: var(--green-light); }
  .sm-widget-action-icon {
    width: 32px; height: 32px; background: var(--green-light);
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0;
  }

  .sm-widget-input-row {
    display: flex; align-items: center; gap: 10px;
    margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;
  }
  .sm-widget-input {
    flex: 1; background: white; border: 1px solid #e5e7eb;
    border-radius: 100px; padding: 10px 16px; font-size: 0.85rem; color: #9ca3af;
  }
  .sm-widget-send {
    width: 36px; height: 36px; background: var(--green);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  /* STATS BAR */
  .sm-stats-bar {
    background: var(--black); padding: 28px 40px;
    display: flex; justify-content: center; gap: 60px; flex-wrap: wrap;
  }
  .sm-stat { text-align: center; }
  .sm-stat-num {
    font-family: 'Syne', sans-serif; font-weight: 800; font-size: 2rem; color: white;
    display: block;
  }
  .sm-stat-num span { color: var(--green-mid); }
  .sm-stat-label { font-size: 0.82rem; color: #9ca3af; margin-top: 4px; }

  /* FEATURES */
  .sm-features { padding: 100px 40px; max-width: 1100px; margin: 0 auto; }
  .sm-section-label {
    font-size: 0.78rem; font-weight: 600; color: var(--green);
    text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;
  }
  .sm-section-title {
    font-family: 'Syne', sans-serif; font-weight: 800;
    font-size: clamp(1.8rem, 3vw, 2.6rem); line-height: 1.15;
    letter-spacing: -0.02em; margin-bottom: 60px; max-width: 500px;
  }

  .sm-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }

  .sm-feature-card {
    background: var(--gray-light); border-radius: 20px; padding: 32px;
    border: 1px solid rgba(0,0,0,0.06); transition: all 0.2s;
  }
  .sm-feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.08); }
  .sm-feature-icon {
    width: 52px; height: 52px; background: var(--green-light);
    border-radius: 14px; display: flex; align-items: center; justify-content: center;
    font-size: 24px; margin-bottom: 20px;
  }
  .sm-feature-card h3 {
    font-family: 'Syne', sans-serif; font-weight: 700; font-size: 1.1rem;
    margin-bottom: 10px;
  }
  .sm-feature-card p { font-size: 0.9rem; color: #6b7280; line-height: 1.6; }

  /* HOW IT WORKS */
  .sm-how { padding: 100px 40px; background: var(--gray-light); }
  .sm-how-inner { max-width: 1100px; margin: 0 auto; }
  .sm-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; margin-top: 60px; }
  .sm-step { position: relative; }
  .sm-step-num {
    font-family: 'Syne', sans-serif; font-weight: 800; font-size: 3rem;
    color: var(--green-light); line-height: 1; margin-bottom: 16px;
  }
  .sm-step h3 { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 1.1rem; margin-bottom: 8px; }
  .sm-step p { font-size: 0.9rem; color: #6b7280; line-height: 1.6; }

  /* INSTALL SECTION */
  .sm-install-section {
    padding: 100px 40px;
    background: var(--black);
    position: relative; overflow: hidden;
  }
  .sm-install-glow {
    position: absolute; top: -100px; left: 50%; transform: translateX(-50%);
    width: 600px; height: 400px;
    background: radial-gradient(ellipse, rgba(22,163,74,0.3) 0%, transparent 70%);
    pointer-events: none;
  }
  .sm-install-inner {
    max-width: 560px; margin: 0 auto; text-align: center; position: relative; z-index: 1;
  }
  .sm-install-inner h2 {
    font-family: 'Syne', sans-serif; font-weight: 800;
    font-size: clamp(2rem, 4vw, 2.8rem); color: white;
    line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 16px;
  }
  .sm-install-inner h2 em { color: var(--green-mid); font-style: normal; }
  .sm-install-inner > p { color: #9ca3af; font-size: 1rem; margin-bottom: 40px; line-height: 1.6; }

  .sm-install-box {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px; padding: 32px;
  }
  .sm-install-input-row {
    display: flex; gap: 0; margin-bottom: 16px;
    border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; overflow: hidden;
    background: rgba(255,255,255,0.05);
  }
  .sm-install-input-row.error { border-color: #ef4444; }
  .sm-install-input {
    flex: 1; background: transparent; border: none; outline: none;
    padding: 14px 18px; font-size: 1rem; color: white;
    font-family: 'DM Sans', sans-serif;
  }
  .sm-install-input::placeholder { color: #6b7280; }
  .sm-install-suffix {
    padding: 14px 18px; color: #6b7280; font-size: 1rem;
    border-left: 1px solid rgba(255,255,255,0.1); white-space: nowrap;
    display: flex; align-items: center;
  }
  .sm-install-btn {
    width: 100%; background: var(--green); color: white; border: none;
    padding: 16px; border-radius: 12px; cursor: pointer;
    font-family: 'Syne', sans-serif; font-weight: 700; font-size: 1.05rem;
    transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .sm-install-btn:hover { background: var(--green-dark); transform: translateY(-2px); }
  .sm-install-note { color: #6b7280; font-size: 0.8rem; margin-top: 16px; }
  .sm-install-note a { color: #9ca3af; }

  .sm-install-features {
    display: flex; justify-content: center; gap: 24px; flex-wrap: wrap;
    margin-bottom: 40px;
  }
  .sm-install-feat { color: #9ca3af; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
  .sm-install-feat svg { color: var(--green-mid); }

  /* FOOTER */
  .sm-footer {
    background: #111; padding: 24px 40px;
    text-align: center; color: #4b5563; font-size: 0.82rem;
  }
  .sm-footer a { color: #6b7280; text-decoration: none; }
  .sm-footer a:hover { color: white; }

  /* RESPONSIVE */
  @media (max-width: 768px) {
    .sm-nav { padding: 16px 20px; }
    .sm-hero { padding: 100px 20px 60px; }
    .sm-hero-inner { grid-template-columns: 1fr; gap: 40px; }
    .sm-widget-mockup { max-width: 340px; margin: 0 auto; }
    .sm-stats-bar { gap: 30px; padding: 24px 20px; }
    .sm-features { padding: 60px 20px; }
    .sm-features-grid { grid-template-columns: 1fr; }
    .sm-steps { grid-template-columns: 1fr; gap: 30px; }
    .sm-how { padding: 60px 20px; }
    .sm-install-section { padding: 60px 20px; }
    .sm-install-features { gap: 16px; }
  }
`;

export default function InstallPage() {
  const [shop, setShop] = useState("");
  const [error, setError] = useState(false);

  function handleInstall() {
    const slug = shop.trim().replace(/\.myshopify\.com.*$/i, "").trim();
    if (!slug) {
      setError(true);
      setTimeout(() => setError(false), 1500);
      return;
    }
    window.location.href = `https://shopmate-ai-helper-production.up.railway.app/auth?shop=${slug}.myshopify.com`;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <nav className="sm-nav">
        <div className="sm-nav-logo">
          <div className="sm-nav-logo-icon">🤖</div>
          ShopMate AI
        </div>
        <a href="#install" className="sm-nav-cta">Install Free →</a>
      </nav>

      {/* HERO */}
      <section className="sm-hero">
        <div className="sm-hero-bg" />
        <div className="sm-hero-dots" />
        <div className="sm-hero-inner">
          <div>
            <div className="sm-hero-badge">
              <span />
              Free Beta — Limited spots available
            </div>
            <h1 className="sm-h1">Stop losing customers to <em>unanswered questions</em></h1>
            <p className="sm-hero-sub">ShopMate AI handles 70% of support tickets automatically — order tracking, product recommendations, and FAQs. 24/7, no extra staff.</p>
            <div className="sm-hero-actions">
              <a href="#install" className="sm-btn-primary">
                Install Free
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
              <div className="sm-hero-trust">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ))}
                &nbsp;Powered by Claude AI
              </div>
            </div>
          </div>

          {/* WIDGET MOCKUP */}
          <div className="sm-widget-mockup">
            <div className="sm-widget-header">
              <div className="sm-widget-avatar">SM</div>
              <div className="sm-widget-header-info">
                <strong>ShopMate AI</strong>
                <span>Shop Assistant · Online</span>
              </div>
              <div className="sm-widget-header-close">×</div>
            </div>
            <div className="sm-widget-body">
              <div className="sm-widget-msg">Hi! 👋 How can I help you today?</div>
              <div className="sm-widget-label">Quick Actions</div>
              <div className="sm-widget-action">
                <div className="sm-widget-action-icon">📦</div>
                Track my order
              </div>
              <div className="sm-widget-action">
                <div className="sm-widget-action-icon">✨</div>
                Recommend a product
              </div>
              <div className="sm-widget-action">
                <div className="sm-widget-action-icon">↩️</div>
                Returns &amp; exchanges
              </div>
              <div className="sm-widget-input-row">
                <div className="sm-widget-input">Type a message...</div>
                <div className="sm-widget-send">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <div className="sm-stats-bar">
        <div className="sm-stat">
          <span className="sm-stat-num"><span>70%</span></span>
          <div className="sm-stat-label">Ticket deflection rate</div>
        </div>
        <div className="sm-stat">
          <span className="sm-stat-num"><span>2</span> min</span>
          <div className="sm-stat-label">Setup time</div>
        </div>
        <div className="sm-stat">
          <span className="sm-stat-num">24/7</span>
          <div className="sm-stat-label">Always available</div>
        </div>
        <div className="sm-stat">
          <span className="sm-stat-num"><span>$0</span></span>
          <div className="sm-stat-label">Free during beta</div>
        </div>
      </div>

      {/* FEATURES */}
      <section className="sm-features">
        <div className="sm-section-label">Features</div>
        <h2 className="sm-section-title">Everything your store needs, handled automatically</h2>
        <div className="sm-features-grid">
          {[
            { icon: "📦", title: "Order Tracking", desc: "Customers ask \"where's my order?\" and get instant answers. No more manual lookups or support emails." },
            { icon: "✨", title: "AI Product Recommendations", desc: "ShopMate learns your catalog and suggests the right products to every customer — boosting AOV automatically." },
            { icon: "🛡️", title: "24/7 FAQ Deflection", desc: "Returns, shipping times, store policies — answered instantly. Your team handles only what truly needs a human." },
            { icon: "👤", title: "Human Escalation", desc: "When AI can't help, it smoothly hands off to your team with full conversation context. No frustrated customers." },
            { icon: "📊", title: "Analytics Dashboard", desc: "See deflection rate, top questions, and chat volume. Know exactly what your customers are asking." },
            { icon: "⚡", title: "Instant Setup", desc: "Widget is live the moment you install. No code, no configuration required. Customize in 2 minutes." },
          ].map(({ icon, title, desc }, i) => (
            <div key={title} className="sm-feature-card" style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="sm-feature-icon">{icon}</div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="sm-how">
        <div className="sm-how-inner">
          <div className="sm-section-label">How it works</div>
          <h2 className="sm-section-title">Live in 3 steps</h2>
          <div className="sm-steps">
            <div className="sm-step">
              <div className="sm-step-num">01</div>
              <h3>Install the app</h3>
              <p>One click from the Shopify install page. Widget automatically appears on your storefront — no theme editing required.</p>
            </div>
            <div className="sm-step">
              <div className="sm-step-num">02</div>
              <h3>Customize in 2 minutes</h3>
              <p>Set your bot name, greeting, and quick action buttons. The AI reads your product catalog automatically.</p>
            </div>
            <div className="sm-step">
              <div className="sm-step-num">03</div>
              <h3>Watch tickets drop</h3>
              <p>Your customers get instant answers. Your support queue shrinks. Your team focuses on real issues.</p>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALL SECTION */}
      <section className="sm-install-section" id="install">
        <div className="sm-install-glow" />
        <div className="sm-install-inner">
          <h2>Start for <em>free</em> today</h2>
          <p>Free during beta. No credit card required. Takes 2 minutes to set up.</p>

          <div className="sm-install-features">
            {["No credit card", "2-minute setup", "Secure OAuth", "Cancel anytime"].map((feat) => (
              <div key={feat} className="sm-install-feat">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7"/></svg>
                {feat}
              </div>
            ))}
          </div>

          <div className="sm-install-box">
            <div className={`sm-install-input-row${error ? " error" : ""}`}>
              <input
                className="sm-install-input"
                type="text"
                placeholder="your-store"
                autoComplete="off"
                spellCheck={false}
                value={shop}
                onChange={(e) => { setShop(e.target.value); setError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleInstall()}
              />
              <div className="sm-install-suffix">.myshopify.com</div>
            </div>
            <button className="sm-install-btn" onClick={handleInstall}>
              Install ShopMate AI — It's Free
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <div className="sm-install-note">
              By installing, you agree to our <a href="#">Terms of Service</a> &amp; <a href="#">Privacy Policy</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="sm-footer">
        <p>© 2026 ShopMate AI · <a href="#">Terms</a> · <a href="#">Privacy</a> · Built for Shopify merchants</p>
      </footer>
    </>
  );
}
