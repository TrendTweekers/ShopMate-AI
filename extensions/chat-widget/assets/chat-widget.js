/**
 * ShopMate AI — Storefront Chat Widget
 * Pure vanilla JS/CSS-in-JS. No build step required.
 * Reads config from window.ShopMateConfig injected by chat-widget.liquid.
 */
(function () {
  "use strict";

  // ── Double-injection guard ──────────────────────────────────────────────
  // The schema's "javascript" key AND the explicit script_tag filter can both
  // load this file, causing the IIFE to run twice. The second run re-queries
  // the same DOM IDs, binds stale references, and silently drops all sends.
  // Guard: bail out if we've already initialised.
  if (window.__shopMateWidgetLoaded) {
    console.warn("[ShopMate] chat-widget.js loaded twice — skipping second init.");
    return;
  }
  window.__shopMateWidgetLoaded = true;

  const cfg = window.ShopMateConfig || {};
  const SHOP = cfg.shop || "";
  const API_BASE = cfg.apiBase || "";
  const PRIMARY = cfg.primaryColor || "#008060";
  const POSITION = cfg.position || "bottom-right";

  // Derive a slightly darker accent from PRIMARY for gradient effects.
  // Works by parsing the hex and reducing each channel by ~15%.
  function darkenHex(hex, amount) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var r = Math.max(0, parseInt(h.slice(0,2),16) - amount);
    var g = Math.max(0, parseInt(h.slice(2,4),16) - amount);
    var b = Math.max(0, parseInt(h.slice(4,6),16) - amount);
    return "#" + [r,g,b].map(function(x){ return x.toString(16).padStart(2,"0"); }).join("");
  }
  var ACCENT = darkenHex(PRIMARY, 24); // ~15% darker for gradient end-stop
  const BOT_NAME = cfg.botName || "ShopMate";
  // Logo URL injected by chat-widget.liquid via {{ 'shopmatelogo.png' | asset_url | json }}
  const LOGO_URL = cfg.logoUrl || "";
  const GREETING = cfg.greeting || "Hi! \uD83D\uDC4B How can I help you today?";
  const SESSION_KEY = "shopmate_conv_id";
  // Quick-reply chips shown below the greeting until the user sends their first message.
  // Merchants can override via ShopMateConfig.quickReplies (array of strings).
  // Pass an empty array [] to disable chips entirely.
  const QUICK_REPLIES = Array.isArray(cfg.quickReplies)
    ? cfg.quickReplies
    : ["Track my order", "Recommend a product", "What's your return policy?", "Talk to a human"];
  // Always relative so Shopify's proxy adds the HMAC signature.
  // API_BASE is "" — kept for backward compat if someone sets it.
  const API_URL   = API_BASE + "/apps/shopmate/chat";
  const TRACK_URL = API_BASE + "/apps/shopmate/track";

  // ── Exit-intent / idle nudge config ────────────────────────────────────────
  // exitIntent: false → disabled entirely. Default: true.
  // exitIntentDelay: ms of inactivity before nudge shows. Default: 30000 (30s).
  // exitIntentMessage: override the nudge text.
  const EXIT_INTENT_ENABLED = cfg.exitIntent !== false;
  const EXIT_INTENT_DELAY   = typeof cfg.exitIntentDelay === "number" ? cfg.exitIntentDelay : 30000;
  const EXIT_INTENT_MSG     = cfg.exitIntentMessage || "\uD83D\uDC4B Need help? I\u2019m here!";
  const EXIT_SESSION_KEY    = "shopmate_nudge_done"; // sessionStorage flag

  console.log("[ShopMate] Initialising. API_URL:", API_URL, "| SHOP:", SHOP);

  // ── State ──────────────────────────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  let conversationId = sessionStorage.getItem(SESSION_KEY) || null;
  let messages = [{ role: "bot", text: GREETING }];
  // Chips are shown until the user sends their first real message.
  let chipsVisible = QUICK_REPLIES.length > 0;
  // Exit-intent nudge — shown once per session
  let nudgeShown = false;
  let nudgeEl = null;
  let idleTimer = null;

  // ── DOM refs ────────────────────────────────────────────────────────────
  let widget, bubble, panel, msgList, inputEl, sendBtn;

  // ── Styles ──────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #shopmate-widget-bubble {
      position: fixed;
      ${POSITION === "bottom-left" ? "left: 20px;" : "right: 20px;"}
      bottom: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${PRIMARY} 0%, ${ACCENT} 100%);
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 8px 32px rgba(0,0,0,.12);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      transition: transform .3s cubic-bezier(0.4, 0, 0.2, 1),
                  box-shadow .3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #shopmate-widget-bubble:hover {
      transform: scale(1.07);
      box-shadow: 0 12px 40px rgba(0,0,0,.18);
    }
    #shopmate-widget-bubble svg { width: 26px; height: 26px; }

    #shopmate-widget-panel {
      position: fixed;
      ${POSITION === "bottom-left" ? "left: 16px;" : "right: 16px;"}
      bottom: 88px;
      width: 340px;
      height: 500px;
      border-radius: 20px;
      background: #fff;
      box-shadow: 0 8px 32px rgba(0,0,0,.12);
      border: 1px solid rgba(0,0,0,.06);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 2147483645;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      transition: opacity .3s cubic-bezier(0.4, 0, 0.2, 1),
                  transform .3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #shopmate-widget-panel.sm-hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateY(16px) scale(.96);
    }

    .sm-header {
      background: linear-gradient(135deg, ${PRIMARY} 0%, ${ACCENT} 100%);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .sm-header-icon {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: rgba(255,255,255,.2);
      display: flex; align-items: center; justify-content: center;
    }
    .sm-header-icon svg { width: 16px; height: 16px; }
    /* Logo image shown in place of the icon when a logoUrl is available */
    .sm-header-logo {
      height: 28px;
      width: auto;
      object-fit: contain;
      /* Invert to white since the header has a coloured gradient background */
      filter: brightness(0) invert(1);
      flex-shrink: 0;
    }
    .sm-header-name { color: #fff; font-weight: 600; font-size: 14px; line-height: 1.2; }
    .sm-header-sub  { color: rgba(255,255,255,.7); font-size: 11px; }

    .sm-messages {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sm-msg-row { display: flex; }
    .sm-msg-row.user { justify-content: flex-end; }
    .sm-bubble {
      max-width: 82%;
      padding: 9px 13px;
      border-radius: 16px;
      line-height: 1.5;
      word-break: break-word;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .sm-bubble.bot  {
      background: #f3f4f6;
      color: #111827;
      border-bottom-left-radius: 4px;
    }
    .sm-bubble.user {
      background: linear-gradient(135deg, ${PRIMARY} 0%, ${ACCENT} 100%);
      color: #fff;
      border-bottom-right-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,.12);
    }
    .sm-bubble.error { background: #fee2e2; color: #b91c1c; }

    /* Quick-reply chips */
    .sm-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 14px 10px;
      flex-shrink: 0;
    }
    .sm-chip {
      padding: 6px 13px;
      border-radius: 999px;
      border: 1.5px solid ${PRIMARY};
      background: #fff;
      color: ${PRIMARY};
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      cursor: pointer;
      line-height: 1.3;
      transition: background .3s cubic-bezier(0.4, 0, 0.2, 1),
                  color .3s cubic-bezier(0.4, 0, 0.2, 1),
                  box-shadow .3s cubic-bezier(0.4, 0, 0.2, 1);
      white-space: nowrap;
    }
    .sm-chip:hover {
      background: linear-gradient(135deg, ${PRIMARY} 0%, ${ACCENT} 100%);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 2px 8px rgba(0,0,0,.12);
    }

    /* Formatted bot reply paragraphs & lists */
    .sm-bubble .sm-para {
      margin: 0 0 6px 0;
      line-height: 1.5;
    }
    .sm-bubble .sm-para:last-child { margin-bottom: 0; }
    .sm-bubble .sm-para--heading { font-weight: 600; }
    .sm-bubble .sm-list {
      margin: 2px 0 6px 0;
      padding-left: 16px;
      list-style: none;
    }
    .sm-bubble .sm-list:last-child { margin-bottom: 0; }
    .sm-bubble .sm-list li {
      position: relative;
      padding-left: 10px;
      margin-bottom: 3px;
      line-height: 1.45;
    }
    .sm-bubble .sm-list li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: ${PRIMARY};
    }

    .sm-products { display: flex; flex-direction: column; gap: 6px; max-width: 88%; margin-top: 4px; }
    .sm-product-card {
      display: flex; align-items: center; gap: 8px;
      padding: 8px; border: 1px solid #e5e7eb; border-radius: 10px;
      text-decoration: none; color: inherit;
      transition: background .12s;
    }
    .sm-product-card:hover { background: #f9fafb; }
    .sm-product-img {
      width: 40px; height: 40px; border-radius: 6px;
      object-fit: cover; background: #f3f4f6; flex-shrink: 0;
    }
    .sm-product-title { font-size: 12px; font-weight: 500; line-height: 1.3; }
    .sm-product-price { font-size: 12px; color: ${PRIMARY}; font-weight: 600; margin-top: 2px; }

    .sm-typing { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: #f3f4f6; border-radius: 14px; width: fit-content; }
    .sm-dot { width: 6px; height: 6px; border-radius: 50%; background: #9ca3af; animation: sm-bounce .9s infinite; }
    .sm-dot:nth-child(2) { animation-delay: .15s; }
    .sm-dot:nth-child(3) { animation-delay: .3s;  }
    @keyframes sm-bounce { 0%,60%,100%{ transform:translateY(0); } 30%{ transform:translateY(-5px); } }

    .sm-input-row {
      display: flex; gap: 8px; padding: 10px 12px;
      border-top: 1px solid rgba(0,0,0,.05); flex-shrink: 0; background: #fff;
    }
    .sm-input {
      flex: 1; border: 1px solid #e5e7eb; border-radius: 12px;
      padding: 9px 13px; font-size: 13px; outline: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: border-color .3s cubic-bezier(0.4, 0, 0.2, 1),
                  box-shadow .3s cubic-bezier(0.4, 0, 0.2, 1);
      background: #f9fafb;
    }
    .sm-input:focus {
      border-color: ${PRIMARY};
      background: #fff;
      box-shadow: 0 0 0 3px ${PRIMARY}22;
    }
    .sm-send {
      width: 38px; height: 38px; border-radius: 12px;
      background: linear-gradient(135deg, ${PRIMARY} 0%, ${ACCENT} 100%);
      color: #fff; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: opacity .3s cubic-bezier(0.4, 0, 0.2, 1),
                  transform .3s cubic-bezier(0.4, 0, 0.2, 1),
                  box-shadow .3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0,0,0,.12);
    }
    .sm-send:not(:disabled):hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0,0,0,.18);
    }
    .sm-send:disabled { opacity: .4; cursor: default; box-shadow: none; }
    .sm-send svg { width: 16px; height: 16px; }

    /* Exit-intent / idle nudge */
    #shopmate-nudge {
      position: fixed;
      ${POSITION === "bottom-left" ? "left: 10px;" : "right: 10px;"}
      bottom: 88px;
      max-width: 220px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,.15);
      padding: 10px 14px 10px 12px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      z-index: 2147483644;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      line-height: 1.4;
      color: #111827;
      cursor: pointer;
      transition: opacity .2s ease, transform .2s ease;
      animation: sm-nudge-in .3s ease forwards;
    }
    #shopmate-nudge.sm-nudge-out {
      opacity: 0;
      transform: translateY(8px) scale(.96);
      pointer-events: none;
    }
    @keyframes sm-nudge-in {
      from { opacity: 0; transform: translateY(8px) scale(.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    #shopmate-nudge-close {
      position: absolute;
      top: 6px;
      right: 8px;
      background: none;
      border: none;
      font-size: 14px;
      line-height: 1;
      color: #9ca3af;
      cursor: pointer;
      padding: 0;
    }
    #shopmate-nudge-close:hover { color: #374151; }
    #shopmate-nudge-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: ${PRIMARY};
      flex-shrink: 0;
      margin-top: 4px;
    }
    /* Attention pulse on the bubble when nudge is visible */
    #shopmate-widget-bubble.sm-pulse {
      box-shadow: 0 8px 32px rgba(0,0,0,.12), 0 0 0 0 ${PRIMARY};
      animation: sm-pulse-ring 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    @keyframes sm-pulse-ring {
      0%   { box-shadow: 0 8px 32px rgba(0,0,0,.12), 0 0 0 0 ${PRIMARY}88; }
      70%  { box-shadow: 0 8px 32px rgba(0,0,0,.12), 0 0 0 14px ${PRIMARY}00; }
      100% { box-shadow: 0 8px 32px rgba(0,0,0,.12), 0 0 0 0 ${PRIMARY}00; }
    }
  `;
  document.head.appendChild(style);

  // ── SVG icons ────────────────────────────────────────────────────────────
  const iconChat = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  const iconX    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const iconSend = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  // ── Markdown → clean HTML ─────────────────────────────────────────────────
  // Converts the LLM's raw markdown-ish output into safe, readable HTML.
  // No external library needed — handles the patterns Claude Haiku actually
  // produces: headings, bold, bullet lists, and literal \n line breaks.
  function formatReply(raw) {
    // 1. Normalise literal "\n" escape sequences (sometimes JSON-encoded twice)
    var s = String(raw || "").replace(/\\n/g, "\n");

    // 2. Split into lines for line-level processing
    var lines = s.split("\n");
    var out = [];
    var inList = false;

    lines.forEach(function(line) {
      var t = line.trim();

      // Skip blank lines — we handle spacing via CSS gap
      if (!t) {
        if (inList) { out.push("</ul>"); inList = false; }
        return;
      }

      // Heading: # Foo  →  plain bold paragraph (conversational tone)
      if (/^#{1,3}\s+/.test(t)) {
        if (inList) { out.push("</ul>"); inList = false; }
        t = t.replace(/^#{1,3}\s+/, "");
        t = inlineFmt(t);
        out.push("<p class=\"sm-para sm-para--heading\">" + t + "</p>");
        return;
      }

      // Bullet: - item  or  * item  →  <li>
      if (/^[-*]\s+/.test(t)) {
        if (!inList) { out.push("<ul class=\"sm-list\">"); inList = true; }
        t = t.replace(/^[-*]\s+/, "");
        out.push("<li>" + inlineFmt(t) + "</li>");
        return;
      }

      // Regular paragraph
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("<p class=\"sm-para\">" + inlineFmt(t) + "</p>");
    });

    if (inList) out.push("</ul>");
    return out.join("");
  }

  // Inline formatting: **bold** → <strong>, strip leftover * / _
  function inlineFmt(s) {
    // Escape HTML first so we don't XSS on the inline replacements
    s = escHtml(s);
    // **bold** or __bold__
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
    // *italic* or _italic_  — strip the markers, keep text
    s = s.replace(/\*(.+?)\*/g, "$1");
    s = s.replace(/_(.+?)_/g, "$1");
    return s;
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function msgHtml(msg) {
    if (msg.loading) {
      return `<div class="sm-msg-row bot"><div class="sm-typing"><div class="sm-dot"></div><div class="sm-dot"></div><div class="sm-dot"></div></div></div>`;
    }

    // ── Upgrade limit bubble ──────────────────────────────────────────────
    if (msg.text === "upgrade_limit") {
      var uUrl = escHtml(msg.upgradeUrl || "#");
      return `<div class="sm-msg-row"><div class="sm-bubble error"><p class="sm-para">You\u2019ve reached the free limit (50 msg/mo).</p><p class="sm-para" style="margin-bottom:8px">Upgrade for unlimited conversations.</p><a href="${uUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:6px 14px;border-radius:8px;background:#008060;color:#fff;font-size:12px;font-weight:600;text-decoration:none">Upgrade \u2192</a></div></div>`;
    }

    // ── Usage hint (soft warning at ≤10 messages left) ────────────────────
    if (msg.isHint) {
      return `<div class="sm-msg-row"><div class="sm-bubble bot" style="font-size:11px;color:#6b7280;padding:5px 10px;">${escHtml(msg.text)}</div></div>`;
    }

    const cls = msg.role === "user" ? "user" : (msg.error ? "error" : "bot");
    // Bot messages: render formatted HTML. User/error messages: plain escaped text.
    var bodyHtml = (msg.role === "bot" && !msg.error)
      ? formatReply(msg.text)
      : "<p class=\"sm-para\">" + escHtml(msg.text) + "</p>";
    let html = `<div class="sm-msg-row ${msg.role === "user" ? "user" : ""}"><div class="sm-bubble ${cls}">${bodyHtml}</div></div>`;
    if (msg.products && msg.products.length) {
      html += `<div class="sm-msg-row"><div class="sm-products" id="sm-products-${msg._pid || ""}">`;
      msg.products.forEach(function(p) {
        // Append shopmate_ref so the storefront's landing_site carries the conv ID
        var ref   = conversationId ? encodeURIComponent(conversationId) : "";
        var href  = escHtml(p.url + (ref ? "?shopmate_ref=" + ref : ""));
        html += `<a class="sm-product-card" href="${href}" target="_blank" rel="noopener noreferrer"
            data-sm-product-id="${escHtml(p.id || "")}"
            data-sm-product-handle="${escHtml(p.handle || "")}"
            data-sm-product-title="${escHtml(p.title || "")}">
          <img class="sm-product-img" src="${escHtml(p.image || "")}" alt="${escHtml(p.title)}" onerror="this.style.display='none'">
          <div><div class="sm-product-title">${escHtml(p.title)}</div><div class="sm-product-price">${escHtml(p.price)}</div></div>
        </a>`;
      });
      html += `</div></div>`;
    }
    return html;
  }

  function escHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function renderMessages() {
    var html = messages.map(msgHtml).join("");
    if (isLoading) {
      html += `<div class="sm-msg-row bot"><div class="sm-typing"><div class="sm-dot"></div><div class="sm-dot"></div><div class="sm-dot"></div></div></div>`;
    }
    msgList.innerHTML = html;
    msgList.scrollTop = msgList.scrollHeight;
    renderChips();
  }

  // ── Quick-reply chips ─────────────────────────────────────────────────────
  function renderChips() {
    // Remove any existing chip row so we re-render cleanly.
    var old = panel.querySelector(".sm-chips");
    if (old) old.remove();

    if (!chipsVisible || isLoading) return;

    var row = document.createElement("div");
    row.className = "sm-chips";

    QUICK_REPLIES.forEach(function(label) {
      var btn = document.createElement("button");
      btn.className = "sm-chip";
      btn.textContent = label;
      btn.addEventListener("click", function() {
        inputEl.value = label;
        sendMessage();
      });
      row.appendChild(btn);
    });

    // Insert chips between the message list and the input row.
    panel.insertBefore(row, panel.querySelector(".sm-input-row"));
  }

  // ── Revenue attribution — product click tracking ─────────────────────────
  // Fire-and-forget: records the click for the ORDERS_CREATE webhook to match.
  function trackProductClick(product) {
    if (!conversationId) return; // no conversation yet — skip
    try {
      fetch(TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // keepalive so the request survives navigating away to the product page
        keepalive: true,
        body: JSON.stringify({
          conversationId: conversationId,
          productId:      product.id     || "",
          productHandle:  product.handle || "",
          productTitle:   product.title  || "",
        }),
      }).catch(function() {}); // silent failure — never interrupt the user
    } catch(e) {}
  }

  // ── API call ──────────────────────────────────────────────────────────────
  function sendMessage() {
    // Read directly from the live DOM node (not a closure copy).
    var text = inputEl.value.trim();

    console.log("[ShopMate] sendMessage() called | text:", JSON.stringify(text), "| isLoading:", isLoading);
    console.log("[ShopMate] inputEl connected:", document.body.contains(inputEl));
    console.log("[ShopMate] sendBtn connected:", document.body.contains(sendBtn));

    if (!text || isLoading) {
      console.log("[ShopMate] Aborted — empty text or already loading.");
      return;
    }

    messages.push({ role: "user", text: text });
    inputEl.value = "";
    isLoading = true;
    chipsVisible = false;  // hide chips permanently once user starts typing
    sendBtn.disabled = true;
    renderMessages();

    console.log("[ShopMate] Fetching", API_URL);

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, conversationId: conversationId, shop: SHOP }),
    })
      .then(function(res) {
        console.log("[ShopMate] Response status:", res.status);
        return res.json().then(function(body) {
          // ── Freemium limit reached (402) ──────────────────────────────────
          if (res.status === 402 && body.error === "limit_reached") {
            console.warn("[ShopMate] Free limit reached");
            var upgradeUrl = body.upgradeUrl || "https://" + SHOP + "/admin/apps/shopmate-ai";
            messages.push({
              role: "bot",
              text: "upgrade_limit",   // sentinel — rendered specially in msgHtml
              upgradeUrl: upgradeUrl,
              error: true,
            });
            return null;
          }
          if (!res.ok) {
            console.error("[ShopMate] Error body:", JSON.stringify(body));
            throw new Error("HTTP " + res.status + (body.debug ? " \u2014 " + body.debug : ""));
          }
          return body;
        });
      })
      .then(function(data) {
        if (!data) return; // limit_reached already handled
        console.log("[ShopMate] Reply received:", data.reply && data.reply.slice(0, 60));
        if (data.conversationId) {
          conversationId = data.conversationId;
          sessionStorage.setItem(SESSION_KEY, conversationId);
        }
        messages.push({ role: "bot", text: data.reply, products: data.products });
        // ── Remaining usage hint ───────────────────────────────────────────
        if (typeof data.remaining === "number" && data.remaining <= 10 && data.remaining > 0) {
          messages.push({
            role: "bot",
            text: data.remaining + " free message" + (data.remaining === 1 ? "" : "s") + " left this month.",
            error: false,
            isHint: true,
          });
        }
      })
      .catch(function(err) {
        console.error("[ShopMate] Fetch error:", err.message);
        messages.push({ role: "bot", text: "Sorry, I\u2019m having trouble connecting. Please try again.", error: true });
      })
      .finally(function() {
        isLoading = false;
        sendBtn.disabled = false;
        renderMessages();
        inputEl.focus();
      });
  }

  // ── Toggle ────────────────────────────────────────────────────────────────
  function togglePanel() {
    isOpen = !isOpen;
    bubble.innerHTML = isOpen ? iconX : iconChat;
    if (isOpen) {
      panel.classList.remove("sm-hidden");
      inputEl.focus();
      hideNudge(true); // opening chat counts as "done"
    } else {
      panel.classList.add("sm-hidden");
    }
  }

  // ── Exit-intent nudge ────────────────────────────────────────────────────
  function showNudge() {
    // Only once per session; don't show if panel already open
    if (nudgeShown || isOpen || sessionStorage.getItem(EXIT_SESSION_KEY)) return;
    nudgeShown = true;

    nudgeEl = document.createElement("div");
    nudgeEl.id = "shopmate-nudge";
    nudgeEl.innerHTML = `
      <button id="shopmate-nudge-close" aria-label="Dismiss">&times;</button>
      <div id="shopmate-nudge-dot"></div>
      <span>${escHtml(EXIT_INTENT_MSG)}</span>
    `;

    // Click anywhere on the nudge → open chat
    nudgeEl.addEventListener("click", function(e) {
      if (e.target.id === "shopmate-nudge-close") {
        e.stopPropagation();
        hideNudge(true);
        return;
      }
      hideNudge(false);
      if (!isOpen) togglePanel();
    });

    document.body.appendChild(nudgeEl);
    bubble.classList.add("sm-pulse");

    // Auto-hide after 8 seconds (don't be annoying)
    setTimeout(function() { hideNudge(false); }, 8000);
  }

  function hideNudge(markDone) {
    if (nudgeEl) {
      nudgeEl.classList.add("sm-nudge-out");
      var el = nudgeEl;
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
      nudgeEl = null;
    }
    bubble.classList.remove("sm-pulse");
    if (markDone) {
      sessionStorage.setItem(EXIT_SESSION_KEY, "1");
    }
    clearIdleTimer();
  }

  // ── Idle / exit-intent detection ─────────────────────────────────────────
  function clearIdleTimer() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  }

  function resetIdleTimer() {
    if (!EXIT_INTENT_ENABLED) return;
    if (sessionStorage.getItem(EXIT_SESSION_KEY)) return; // already done this session
    clearIdleTimer();
    idleTimer = setTimeout(showNudge, EXIT_INTENT_DELAY);
  }

  function initExitIntent() {
    if (!EXIT_INTENT_ENABLED) return;
    if (sessionStorage.getItem(EXIT_SESSION_KEY)) return;

    // Idle detection — reset timer on any user activity
    var activityEvents = ["mousemove", "mousedown", "touchstart", "keydown", "scroll", "click"];
    activityEvents.forEach(function(ev) {
      document.addEventListener(ev, resetIdleTimer, { passive: true });
    });

    // Classic exit-intent: mouse leaves viewport toward the top
    document.addEventListener("mouseleave", function(e) {
      if (e.clientY < window.innerHeight * 0.08) {
        // Cursor moved to the top 8% of the screen — likely leaving the tab
        showNudge();
      }
    });

    // Kick off the idle timer immediately
    resetIdleTimer();
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────
  function init() {
    // Remove any previously-injected widget (safety net for hot reloads).
    var existing = document.getElementById("shopmate-widget");
    if (existing) existing.remove();

    widget = document.createElement("div");
    widget.id = "shopmate-widget";

    // Panel — built with createElement so event bindings are on real nodes,
    // not innerHTML-parsed clones that lose listeners.
    panel = document.createElement("div");
    panel.id = "shopmate-widget-panel";
    panel.className = "sm-hidden";

    // Header
    var header = document.createElement("div");
    header.className = "sm-header";
    // Show the ShopMate logo if a URL was injected by the Liquid template;
    // fall back to the generic icon circle if not available.
    var headerLeft = LOGO_URL
      ? `<img src="${escHtml(LOGO_URL)}" alt="ShopMate AI" class="sm-header-logo" />`
      : `<div class="sm-header-icon">${iconChat}</div>`;
    header.innerHTML = `
      ${headerLeft}
      <div>
        <div class="sm-header-name">${escHtml(BOT_NAME)}</div>
        <div class="sm-header-sub">Always here to help</div>
      </div>
    `;

    // Message list
    msgList = document.createElement("div");
    msgList.className = "sm-messages";
    msgList.id = "sm-messages";

    // Input row — create each element individually so refs are exact nodes,
    // not getElementById lookups that could collide with a second injection.
    var inputRow = document.createElement("div");
    inputRow.className = "sm-input-row";

    inputEl = document.createElement("input");
    inputEl.className = "sm-input";
    inputEl.type = "text";
    inputEl.placeholder = "Type a message\u2026";
    inputEl.autocomplete = "off";

    sendBtn = document.createElement("button");
    sendBtn.className = "sm-send";
    sendBtn.setAttribute("aria-label", "Send");
    sendBtn.innerHTML = iconSend;

    inputRow.appendChild(inputEl);
    inputRow.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(msgList);
    panel.appendChild(inputRow);

    // Bubble
    bubble = document.createElement("button");
    bubble.id = "shopmate-widget-bubble";
    bubble.setAttribute("aria-label", "Open ShopMate chat");
    bubble.innerHTML = iconChat;
    bubble.addEventListener("click", togglePanel);

    widget.appendChild(panel);
    widget.appendChild(bubble);
    document.body.appendChild(widget);

    // Bind events directly to the nodes we hold references to.
    sendBtn.addEventListener("click", function() {
      console.log("[ShopMate] Send button clicked");
      sendMessage();
    });
    inputEl.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        console.log("[ShopMate] Enter key pressed");
        sendMessage();
      }
    });

    renderMessages();
    console.log("[ShopMate] Widget ready. sendBtn in DOM:", document.body.contains(sendBtn));

    // Delegated click listener for product cards — fires AFTER innerHTML renders
    msgList.addEventListener("click", function(e) {
      var card = e.target.closest(".sm-product-card");
      if (!card) return;
      trackProductClick({
        id:     card.getAttribute("data-sm-product-id")     || "",
        handle: card.getAttribute("data-sm-product-handle") || "",
        title:  card.getAttribute("data-sm-product-title")  || "",
      });
    });

    // Start exit-intent / idle nudge detection
    initExitIntent();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
