import { useMemo, useState } from "react";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href:
      "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap",
  },
];

const css = `
  *, *::before, *::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; font-family: 'DM Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0a0a0a; background: #fff; overflow-x: hidden; }

  :root{
    --green:#16a34a;
    --green-dark:#15803d;
    --green-light:#dcfce7;
    --green-mid:#22c55e;
    --black:#0a0a0a;
    --text:#111827;
    --muted:#4b5563;
    --muted2:#6b7280;
    --border: rgba(0,0,0,0.08);
    --card: rgba(255,255,255,0.9);
  }

  /* Layout */
  .sm-container{
    width: 100%;
    max-width: 1160px;
    margin: 0 auto;
    padding: 0 28px;
  }

  /* NAV */
  .sm-nav{
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    background: rgba(255,255,255,0.82);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .sm-nav-inner{
    height: 72px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 18px;
  }
  .sm-brand{
    display:flex; align-items:center; gap: 12px;
    text-decoration:none;
    color: var(--text);
    min-width: 240px;
  }
  .sm-brand-mark{
    width: 40px; height: 40px;
    border-radius: 12px;
    background: linear-gradient(180deg, var(--green) 0%, var(--green-dark) 100%);
    display:flex; align-items:center; justify-content:center;
    color: #fff;
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .sm-brand-name{
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 1.15rem;
    letter-spacing: -0.02em;
  }

  .sm-nav-links{
    display:flex; align-items:center; justify-content:center;
    gap: 22px;
  }
  .sm-nav-links a{
    text-decoration:none;
    color: #374151;
    font-size: 0.95rem;
    font-weight: 500;
    padding: 8px 10px;
    border-radius: 10px;
    transition: background .15s, color .15s;
  }
  .sm-nav-links a:hover{
    background: rgba(22,163,74,0.10);
    color: #14532d;
  }

  .sm-nav-cta-wrap{
    display:flex;
    justify-content:flex-end;
    min-width: 240px;
  }
  .sm-nav-cta{
    display:inline-flex; align-items:center; justify-content:center;
    gap: 8px;
    text-decoration:none;
    background: var(--green);
    color: #fff;
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 0.95rem;
    padding: 10px 18px;
    border-radius: 999px;
    transition: transform .15s, background .15s, box-shadow .15s;
    box-shadow: 0 10px 24px rgba(22,163,74,0.22);
  }
  .sm-nav-cta:hover{
    background: var(--green-dark);
    transform: translateY(-1px);
    box-shadow: 0 14px 28px rgba(22,163,74,0.28);
  }

  /* HERO */
  .sm-hero{
    padding: 120px 0 70px;
    min-height: 92vh;
    position: relative;
    overflow: hidden;
  }
  .sm-hero-bg{
    position:absolute; inset:0;
    background:
      radial-gradient(ellipse 80% 55% at 45% 0%, rgba(220,252,231,1) 0%, rgba(220,252,231,0.0) 70%),
      radial-gradient(circle at 90% 30%, rgba(34,197,94,0.10), transparent 45%);
    z-index:0;
  }
  .sm-hero-dots{
    position:absolute; inset:0;
    background-image: radial-gradient(circle, rgba(17,24,39,0.12) 1px, transparent 1px);
    background-size: 34px 34px;
    opacity: 0.22;
    z-index:0;
  }
  .sm-hero-inner{
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    align-items: center;
    gap: 54px;
    padding-top: 18px;
  }

  .sm-badge{
    display:inline-flex; align-items:center; gap: 10px;
    background: rgba(220,252,231,0.85);
    border: 1px solid rgba(34,197,94,0.22);
    color: #14532d;
    border-radius: 999px;
    padding: 8px 14px;
    font-size: 0.86rem;
    font-weight: 600;
    margin-bottom: 18px;
    width: fit-content;
  }
  .sm-badge i{
    width: 8px; height: 8px; border-radius: 999px;
    background: var(--green);
    display:inline-block;
    animation: smPulse 1.8s ease-in-out infinite;
  }
  @keyframes smPulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }

  .sm-h1{
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 20px 0;
    font-size: clamp(2.2rem, 4vw, 3.2rem);
    line-height: 1.1;
    max-width: 720px;
  }
  .sm-h1 em{ color: var(--green); font-style: normal; }

  .sm-sub{
    margin: 0 0 26px 0;
    color: var(--muted);
    font-size: 1.08rem;
    line-height: 1.65;
    max-width: 560px;
  }

  .sm-actions{
    display:flex; align-items:center; gap: 14px; flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .sm-btn{
    display:inline-flex; align-items:center; gap: 10px;
    text-decoration:none;
    border-radius: 999px;
    padding: 13px 22px;
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    transition: transform .15s, background .15s, box-shadow .15s, border-color .15s;
    user-select: none;
  }
  .sm-btn-primary{
    background: var(--green);
    color: #fff;
    box-shadow: 0 14px 34px rgba(22,163,74,0.25);
  }
  .sm-btn-primary:hover{
    background: var(--green-dark);
    transform: translateY(-2px);
    box-shadow: 0 18px 40px rgba(22,163,74,0.30);
  }
  .sm-btn-secondary{
    background: rgba(255,255,255,0.65);
    border: 1px solid var(--border);
    color: #111827;
  }
  .sm-btn-secondary:hover{
    background: rgba(255,255,255,0.95);
    transform: translateY(-1px);
    border-color: rgba(22,163,74,0.25);
  }

  .sm-trust{
    display:flex; align-items:center; gap: 10px; flex-wrap: wrap;
    color: var(--muted2);
    font-size: 0.92rem;
  }
  .sm-stars{ display:inline-flex; gap: 4px; color: #f59e0b; }

  /* Widget mock */
  .sm-widget{
    background: #fff;
    border-radius: 22px;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.06);
    box-shadow: 0 30px 80px rgba(0,0,0,0.12);
    max-width: 360px;
    margin-left: auto;
    transform: translateY(0);
    animation: smFloat 4.2s ease-in-out infinite;
  }
  @keyframes smFloat { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-10px) } }

  .sm-widget-head{
    background: linear-gradient(180deg, var(--green) 0%, var(--green-dark) 100%);
    padding: 16px 18px;
    display:flex; align-items:center; gap: 12px;
  }
  .sm-widget-logo{
    width: 36px; height: 36px;
    border-radius: 12px;
    background: rgba(255,255,255,0.18);
    display:flex; align-items:center; justify-content:center;
    color:#fff;
    font-family:'Syne',sans-serif;
    font-weight:800;
    letter-spacing:-0.02em;
  }
  .sm-widget-meta strong{ display:block; color:#fff; font-family:'Syne',sans-serif; font-weight:800; font-size: 1rem; }
  .sm-widget-meta span{ display:block; color: rgba(255,255,255,0.82); font-size: 0.82rem; margin-top: 2px; }

  .sm-widget-body{ padding: 18px; background: #f8fafc; }
  .sm-bubble{
    background:#fff;
    border: 1px solid rgba(0,0,0,0.06);
    box-shadow: 0 10px 24px rgba(0,0,0,0.06);
    padding: 12px 14px;
    border-radius: 14px 14px 14px 6px;
    color:#374151;
    font-size: 0.92rem;
    line-height: 1.5;
    max-width: 92%;
  }
  .sm-label{
    margin: 14px 0 10px;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #9ca3af;
    font-weight: 700;
  }
  .sm-quick{
    display:flex; flex-direction: column; gap: 8px;
  }
  .sm-quick button{
    width: 100%;
    text-align:left;
    display:flex; align-items:center; gap: 12px;
    background:#fff;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 14px;
    padding: 12px 12px;
    cursor:pointer;
    transition: transform .12s, border-color .12s, background .12s;
    font-size: 0.92rem;
    color:#111827;
  }
  .sm-quick button:hover{
    transform: translateY(-1px);
    border-color: rgba(22,163,74,0.25);
    background: rgba(220,252,231,0.55);
  }
  .sm-quick i{
    width: 32px; height: 32px;
    border-radius: 12px;
    background: rgba(220,252,231,0.9);
    display:flex; align-items:center; justify-content:center;
    font-style: normal;
  }

  /* Stats */
  .sm-stats{
    background: #0b0b0b;
    color: #fff;
    padding: 26px 0;
  }
  .sm-stats-grid{
    display:flex;
    justify-content: center;
    gap: 56px;
    flex-wrap: wrap;
  }
  .sm-stat{
    text-align:center;
    min-width: 140px;
  }
  .sm-stat strong{
    display:block;
    font-family:'Syne',sans-serif;
    font-weight: 800;
    font-size: 1.9rem;
    letter-spacing: -0.02em;
  }
  .sm-stat strong span{ color: var(--green-mid); }
  .sm-stat small{ display:block; margin-top: 6px; color: #9ca3af; font-size: 0.86rem; }

  /* Sections */
  .sm-section{ padding: 92px 0; }
  .sm-section.gray{ background: #f9fafb; }
  .sm-kicker{
    color: var(--green-dark);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.78rem;
    margin-bottom: 12px;
    font-family:'Syne',sans-serif;
  }
  .sm-h2{
    font-family:'Syne',sans-serif;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-size: clamp(1.7rem, 3vw, 2.4rem);
    line-height: 1.15;
    margin: 0 0 40px 0;
    max-width: 720px;
  }

  /* Features grid */
  .sm-grid{
    display:grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }
  .sm-card{
    background:#fff;
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 18px;
    padding: 22px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.04);
    transition: transform .15s, box-shadow .15s, border-color .15s;
  }
  .sm-card:hover{
    transform: translateY(-3px);
    border-color: rgba(22,163,74,0.20);
    box-shadow: 0 22px 55px rgba(0,0,0,0.07);
  }
  .sm-card .icon{
    width: 48px; height: 48px;
    border-radius: 16px;
    background: rgba(220,252,231,0.9);
    display:flex; align-items:center; justify-content:center;
    margin-bottom: 14px;
    font-size: 20px;
  }
  .sm-card h3{
    margin: 0 0 8px 0;
    font-family:'Syne',sans-serif;
    font-weight: 800;
    font-size: 1.05rem;
    letter-spacing: -0.02em;
  }
  .sm-card p{
    margin: 0;
    color: #6b7280;
    line-height: 1.6;
    font-size: 0.95rem;
  }

  /* Pricing */
  .sm-pricing{
    display:grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
    align-items: stretch;
  }
  .sm-price{
    background:#fff;
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.04);
  }
  .sm-price.top{
    border-color: rgba(22,163,74,0.28);
    box-shadow: 0 22px 60px rgba(22,163,74,0.12);
  }
  .sm-price h3{
    margin: 0 0 6px 0;
    font-family:'Syne',sans-serif;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .sm-price .tag{
    display:inline-flex;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 800;
    background: rgba(220,252,231,0.9);
    border: 1px solid rgba(22,163,74,0.18);
    color: #14532d;
    margin-bottom: 12px;
  }
  .sm-price .amt{
    font-family:'Syne',sans-serif;
    font-weight: 800;
    font-size: 2.2rem;
    letter-spacing: -0.03em;
    margin: 10px 0 8px;
  }
  .sm-price .amt small{ font-size: 0.95rem; color:#6b7280; font-weight: 700; }
  .sm-price ul{ margin: 14px 0 0; padding: 0; list-style: none; display:flex; flex-direction:column; gap: 10px; }
  .sm-price li{ display:flex; gap: 10px; color:#374151; line-height: 1.45; }
  .sm-check{
    width: 18px; height: 18px; border-radius: 6px;
    background: rgba(22,163,74,0.16);
    display:flex; align-items:center; justify-content:center;
    color: var(--green-dark);
    flex: 0 0 auto;
    font-weight: 800;
    margin-top: 2px;
  }

  /* Install */
  .sm-install{
    background: #0b0b0b;
    color: #fff;
    position: relative;
    overflow:hidden;
  }
  .sm-install-glow{
    position:absolute;
    top:-140px; left:50%;
    transform: translateX(-50%);
    width: 740px; height: 520px;
    background: radial-gradient(ellipse, rgba(22,163,74,0.30) 0%, transparent 70%);
    pointer-events:none;
  }
  .sm-install-inner{
    position: relative;
    z-index: 1;
    text-align: center;
    max-width: 760px;
    margin: 0 auto;
  }
  .sm-install-inner .sm-h2{ color:#fff; max-width: 760px; margin-left:auto; margin-right:auto; }
  .sm-install-inner p{ color:#9ca3af; margin: 0 auto 26px; max-width: 640px; line-height:1.65; }

  .sm-install-box{
    margin-top: 10px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 18px;
    padding: 18px;
  }
  .sm-input-row{
    display:flex;
    border-radius: 14px;
    overflow:hidden;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.05);
  }
  .sm-input-row.error{
    border-color: rgba(239,68,68,0.9);
  }
  .sm-input{
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    padding: 14px 16px;
    color: #fff;
    font-size: 1rem;
  }
  .sm-suffix{
    padding: 14px 14px;
    color: #9ca3af;
    border-left: 1px solid rgba(255,255,255,0.12);
    display:flex; align-items:center;
    white-space: nowrap;
    font-size: 1rem;
  }
  .sm-install-btn{
    width: 100%;
    margin-top: 12px;
    border: none;
    cursor: pointer;
    background: var(--green);
    color: #fff;
    border-radius: 14px;
    padding: 14px 18px;
    font-family:'Syne',sans-serif;
    font-weight: 800;
    font-size: 1.05rem;
    display:flex; align-items:center; justify-content:center; gap: 10px;
    transition: transform .15s, background .15s, box-shadow .15s;
    box-shadow: 0 18px 40px rgba(22,163,74,0.18);
  }
  .sm-install-btn:hover{
    background: var(--green-dark);
    transform: translateY(-2px);
    box-shadow: 0 22px 52px rgba(22,163,74,0.22);
  }
  .sm-note{
    margin-top: 12px;
    color: #6b7280;
    font-size: 0.82rem;
    line-height: 1.5;
  }
  .sm-note a{ color: #9ca3af; text-decoration: none; }
  .sm-note a:hover{ color: #fff; }

  .sm-footer{
    background: #0f0f0f;
    color: #6b7280;
    padding: 22px 0;
    font-size: 0.85rem;
    text-align:center;
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  .sm-footer a{ color:#9ca3af; text-decoration:none; }
  .sm-footer a:hover{ color:#fff; }

  /* Responsive */
  @media (max-width: 980px){
    .sm-nav-inner{ grid-template-columns: 1fr 1fr; }
    .sm-nav-links{ display:none; }
    .sm-hero-inner{ grid-template-columns: 1fr; gap: 32px; }
    .sm-widget{ margin-left: 0; max-width: 420px; }
    .sm-grid{ grid-template-columns: 1fr; }
    .sm-pricing{ grid-template-columns: 1fr; }
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
    const clientId = "9b1e966350cee0ffb9d2b6f46719da03";
    const scopes = "read_products,read_orders,read_customers,write_script_tags";
    const redirectUri = "https://shopmate-ai-helper-production.up.railway.app/auth/callback";
    const shopifyAuthUrl = `https://${slug}.myshopify.com/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = shopifyAuthUrl;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <header className="sm-nav">
        <div className="sm-container">
          <div className="sm-nav-inner">
            <a className="sm-brand" href="#top">
              <div className="sm-brand-mark">SM</div>
              <div className="sm-brand-name">ShopMate AI</div>
            </a>

            <nav className="sm-nav-links" aria-label="Primary">
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#install">Install</a>
            </nav>

            <div className="sm-nav-cta-wrap">
              <a className="sm-nav-cta" href="#install">
                Install
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="sm-hero">
          <div className="sm-hero-bg" />
          <div className="sm-hero-dots" />

          <div className="sm-container">
            <div className="sm-hero-inner">
              <div>
                <div className="sm-badge">
                  <i />
                  Built for Shopify stores · Secure OAuth install
                </div>

                <h1 className="sm-h1">
                  AI chat that <em>knows your catalog</em> — and tracks orders automatically
                </h1>

                <p className="sm-sub">
                  ShopMate AI answers common questions instantly (orders, products, policies) and shows what it's
                  saving you — and earning you — in a simple dashboard.
                </p>

                <div className="sm-actions">
                  <a className="sm-btn sm-btn-primary" href="#install">
                    Install free
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                  <a className="sm-btn sm-btn-secondary" href="#pricing">
                    See pricing
                  </a>
                </div>

                <div className="sm-trust" aria-label="Trust indicators">
                  <span className="sm-stars" aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </span>
                  <span>Revenue + deflection dashboard · Uses real Shopify products & orders</span>
                </div>
              </div>

              <aside className="sm-widget" aria-label="Widget preview">
                <div className="sm-widget-head">
                  <div className="sm-widget-logo">SM</div>
                  <div className="sm-widget-meta">
                    <strong>ShopMate AI</strong>
                    <span>Shop assistant · Online</span>
                  </div>
                </div>
                <div className="sm-widget-body">
                  <div className="sm-bubble">
                    Hi — I can track orders, suggest products, and answer policy questions. What do you need?
                  </div>
                  <div className="sm-label">Example questions</div>
                  <div className="sm-quick">
                    <button type="button">
                      <i>1</i> Track order 5050
                    </button>
                    <button type="button">
                      <i>2</i> Best sellers under $50
                    </button>
                    <button type="button">
                      <i>3</i> What is your return policy?
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="sm-stats" aria-label="Key stats">
          <div className="sm-container">
            <div className="sm-stats-grid">
              <div className="sm-stat">
                <strong>
                  <span>70%</span>
                </strong>
                <small>Ticket deflection rate</small>
              </div>
              <div className="sm-stat">
                <strong>
                  <span>2</span> min
                </strong>
                <small>Setup time</small>
              </div>
              <div className="sm-stat">
                <strong>24/7</strong>
                <small>Always available</small>
              </div>
              <div className="sm-stat">
                <strong>
                  <span>$0</span>
                </strong>
                <small>Free during beta</small>
              </div>
            </div>
          </div>
        </section>

        <section className="sm-section" id="features">
          <div className="sm-container">
            <div className="sm-kicker">Features</div>
            <h2 className="sm-h2">Everything your store needs, handled automatically</h2>

            <div className="sm-grid">
              {[
                {
                  icon: "📦",
                  title: "Order tracking",
                  desc: 'Customers ask "where\'s my order?" and get instant answers. No more manual lookups.',
                },
                {
                  icon: "✨",
                  title: "AI product recommendations",
                  desc: "Pulls from your Shopify catalog and suggests relevant products to boost AOV.",
                },
                {
                  icon: "🛡️",
                  title: "Policies & FAQs",
                  desc: "Returns, shipping times, store policies — answered instantly so tickets don't reach your inbox.",
                },
                {
                  icon: "👤",
                  title: "Escalation to human",
                  desc: "When AI can't help, it hands off with full conversation context.",
                },
                {
                  icon: "📊",
                  title: "Analytics dashboard",
                  desc: "See deflection rate, chat volume, and what customers ask most.",
                },
                {
                  icon: "⚡",
                  title: "Fast setup",
                  desc: "Install → widget live. Customize in minutes, no theme editing required.",
                },
              ].map((f) => (
                <div key={f.title} className="sm-card">
                  <div className="icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sm-section gray" id="pricing">
          <div className="sm-container">
            <div className="sm-kicker">Pricing</div>
            <h2 className="sm-h2">Start free. Upgrade when you're ready.</h2>

            <div className="sm-pricing">
              <div className="sm-price">
                <div className="tag">Free</div>
                <h3>Free plan</h3>
                <div className="amt">
                  $0 <small>/ month</small>
                </div>
                <ul>
                  <li>
                    <span className="sm-check">✓</span> 50 messages / month
                  </li>
                  <li>
                    <span className="sm-check">✓</span> Order tracking + product recs
                  </li>
                  <li>
                    <span className="sm-check">✓</span> Policies imported from Shopify
                  </li>
                  <li>
                    <span className="sm-check">✓</span> Basic analytics
                  </li>
                </ul>
              </div>

              <div className="sm-price top">
                <div className="tag">Most popular</div>
                <h3>Pro</h3>
                <div className="amt">
                  $39 <small>/ month</small>
                </div>
                <ul>
                  <li>
                    <span className="sm-check">✓</span> Unlimited messages
                  </li>
                  <li>
                    <span className="sm-check">✓</span> Advanced analytics + revenue attribution
                  </li>
                  <li>
                    <span className="sm-check">✓</span> Priority support
                  </li>
                  <li>
                    <span className="sm-check">✓</span> Everything in Free
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="sm-section sm-install" id="install">
          <div className="sm-install-glow" />
          <div className="sm-container">
            <div className="sm-install-inner">
              <div className="sm-kicker" style={{ color: "rgba(34,197,94,0.9)" }}>
                Install
              </div>
              <h2 className="sm-h2">
                Start for <span style={{ color: "var(--green-mid)" }}>free</span> today
              </h2>
              <p>Free during beta. No credit card required. Takes about 2 minutes to set up.</p>

              <div className="sm-install-box">
                <div className={`sm-input-row${error ? " error" : ""}`}>
                  <input
                    className="sm-input"
                    type="text"
                    placeholder="your-store"
                    autoComplete="off"
                    spellCheck={false}
                    value={shop}
                    onChange={(e) => {
                      setShop(e.target.value);
                      setError(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleInstall()}
                  />
                  <div className="sm-suffix">.myshopify.com</div>
                </div>

                <button className="sm-install-btn" onClick={handleInstall}>
                  Install ShopMate AI
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>

                <div className="sm-note">
                  By installing, you agree to our <a href="/terms">Terms of Service</a> and{" "}
                  <a href="/privacy">Privacy Policy</a>.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="sm-footer">
        <div className="sm-container">
          © 2026 ShopMate AI · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
        </div>
      </footer>
    </>
  );
}
