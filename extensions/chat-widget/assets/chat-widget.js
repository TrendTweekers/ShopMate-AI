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
  const BOT_NAME = cfg.botName || "ShopMate";
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
  const API_URL = API_BASE + "/apps/shopmate/chat";

  console.log("[ShopMate] Initialising. API_URL:", API_URL, "| SHOP:", SHOP);

  // ── State ──────────────────────────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  let conversationId = sessionStorage.getItem(SESSION_KEY) || null;
  let messages = [{ role: "bot", text: GREETING }];
  // Chips are shown until the user sends their first real message.
  let chipsVisible = QUICK_REPLIES.length > 0;

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
      background: ${PRIMARY};
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,.22);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      transition: transform .15s ease;
    }
    #shopmate-widget-bubble:hover { transform: scale(1.07); }
    #shopmate-widget-bubble svg { width: 26px; height: 26px; }

    #shopmate-widget-panel {
      position: fixed;
      ${POSITION === "bottom-left" ? "left: 16px;" : "right: 16px;"}
      bottom: 88px;
      width: 340px;
      height: 500px;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      border: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 2147483645;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      transition: opacity .2s ease, transform .2s ease;
    }
    #shopmate-widget-panel.sm-hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px) scale(.97);
    }

    .sm-header {
      background: ${PRIMARY};
      padding: 12px 16px;
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
      padding: 8px 12px;
      border-radius: 14px;
      line-height: 1.45;
      word-break: break-word;
    }
    .sm-bubble.bot  { background: #f3f4f6; color: #111827; border-bottom-left-radius: 4px; }
    .sm-bubble.user { background: ${PRIMARY}; color: #fff; border-bottom-right-radius: 4px; }
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
      padding: 6px 12px;
      border-radius: 999px;
      border: 1.5px solid ${PRIMARY};
      background: #fff;
      color: ${PRIMARY};
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      line-height: 1.3;
      transition: background .12s, color .12s;
      white-space: nowrap;
    }
    .sm-chip:hover { background: ${PRIMARY}; color: #fff; }

    /* ── Review popup (all 3 versions share this base) ── */
    .sm-review-popup {
      position: absolute;
      bottom: 100%;
      ${POSITION === "bottom-left" ? "left: 0;" : "right: 0;"}
      margin-bottom: 10px;
      width: 280px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      box-shadow: 0 4px 24px rgba(0,0,0,.16);
      padding: 16px;
      font-size: 13px;
      z-index: 2147483647;
      animation: sm-popup-in .22s ease;
    }
    /* Version 3: small banner variant */
    .sm-review-popup.sm-review-banner {
      padding: 10px 14px;
      width: 260px;
    }
    @keyframes sm-popup-in { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }

    /* Celebration header (Version 1) */
    .sm-review-celebrate {
      text-align: center;
      margin-bottom: 10px;
    }
    .sm-review-celebrate .sm-review-emoji {
      font-size: 28px;
      display: block;
      margin-bottom: 4px;
    }
    .sm-review-celebrate .sm-review-title {
      font-weight: 700;
      font-size: 14px;
      color: #111827;
      margin: 0 0 4px;
    }
    .sm-review-celebrate .sm-review-sub {
      font-size: 12px;
      color: #6b7280;
      margin: 0;
    }

    /* Sentiment row (Version 2) */
    .sm-review-sentiment {
      display: flex;
      justify-content: center;
      gap: 14px;
      margin: 10px 0 6px;
    }
    .sm-review-sentiment button {
      font-size: 22px;
      background: none;
      border: 2px solid transparent;
      border-radius: 50%;
      width: 44px; height: 44px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: border-color .12s, background .12s;
      padding: 0;
    }
    .sm-review-sentiment button:hover { border-color: ${PRIMARY}; background: hsl(160 100% 96%); }
    .sm-review-sentiment-label {
      font-size: 11px;
      color: #6b7280;
      text-align: center;
      margin-bottom: 8px;
    }

    /* Shared action buttons */
    .sm-review-popup p { margin: 0 0 10px; line-height: 1.4; color: #111827; }
    .sm-review-actions { display: flex; gap: 8px; }
    .sm-review-yes {
      flex: 1; padding: 7px; border-radius: 8px; border: none;
      background: ${PRIMARY}; color: #fff; font-size: 12px; font-weight: 600;
      cursor: pointer; text-align: center; text-decoration: none; display: block;
    }
    .sm-review-yes:hover { opacity: .9; }
    .sm-review-dismiss {
      padding: 7px 10px; border-radius: 8px;
      border: 1px solid #d1d5db; background: #fff; color: #6b7280;
      font-size: 12px; cursor: pointer;
    }
    /* Banner dismiss ✕ */
    .sm-review-banner-dismiss {
      position: absolute; top: 8px; right: 10px;
      background: none; border: none; cursor: pointer;
      color: #9ca3af; font-size: 16px; line-height: 1; padding: 0;
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
      border-top: 1px solid #e5e7eb; flex-shrink: 0; background: #fff;
    }
    .sm-input {
      flex: 1; border: 1px solid #d1d5db; border-radius: 10px;
      padding: 8px 12px; font-size: 13px; outline: none;
      font-family: inherit;
      transition: border-color .15s;
    }
    .sm-input:focus { border-color: ${PRIMARY}; }
    .sm-send {
      width: 36px; height: 36px; border-radius: 10px;
      background: ${PRIMARY}; color: #fff; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: opacity .15s;
    }
    .sm-send:disabled { opacity: .45; cursor: default; }
    .sm-send svg { width: 16px; height: 16px; }
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
      html += `<div class="sm-msg-row"><div class="sm-products">`;
      msg.products.forEach(function(p) {
        html += `<a class="sm-product-card" href="${escHtml(p.url)}" target="_blank" rel="noopener noreferrer">
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
        // ── Review popup ───────────────────────────────────────────────────
        if (data.showReview) {
          setTimeout(function() {
            showReviewPopup(data.reviewTrigger || null, data.aiHandledChats || 0);
          }, 900);
        }
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

  // ── Review system ──────────────────────────────────────────────────────────
  var REVIEW_URL = "https://apps.shopify.com/shopmate-ai/reviews/new";

  /** POST review feedback to the proxy so the backend can update DB */
  function sendReviewFeedback(reviewAction) {
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewAction: reviewAction }),
    }).catch(function(e) {
      console.warn("[ShopMate] Review feedback failed:", e.message);
    });
  }

  /**
   * showReviewPopup(trigger, aiHandledChats)
   *
   * Version 1 — Celebration Modal  (trigger = "ai_handled" | "usage_milestone")
   * Version 2 — Sentiment Gate     (trigger = "order_tracking")
   * Version 3 — Small Banner       (fallback / no trigger data)
   *
   * Each version:
   *   "Leave a review" → open review link + sendReviewFeedback("reviewed")
   *   "Maybe later" / dismiss → sendReviewFeedback("dismissed") + remove popup
   */
  function showReviewPopup(trigger, aiHandledChats) {
    // Only one popup at a time
    if (document.getElementById("sm-review-popup")) return;

    var popup = document.createElement("div");
    popup.id = "sm-review-popup";

    function onReview() {
      window.open(REVIEW_URL, "_blank", "noopener,noreferrer");
      sendReviewFeedback("reviewed");
      popup.remove();
    }
    function onDismiss() {
      sendReviewFeedback("dismissed");
      popup.remove();
    }

    // ── Choose version based on trigger ───────────────────────────────────
    if (trigger === "ai_handled" || trigger === "usage_milestone") {
      // ── Version 1: Celebration Modal ─────────────────────────────────────
      popup.className = "sm-review-popup";

      var celebrate = document.createElement("div");
      celebrate.className = "sm-review-celebrate";

      var emoji = document.createElement("span");
      emoji.className = "sm-review-emoji";
      emoji.textContent = "\uD83C\uDF89"; // 🎉
      celebrate.appendChild(emoji);

      var title = document.createElement("p");
      title.className = "sm-review-title";
      var chatCount = typeof aiHandledChats === "number" && aiHandledChats > 0
        ? aiHandledChats
        : 3;
      title.textContent = "ShopMate has handled " + chatCount + " customer chat" + (chatCount !== 1 ? "s" : "") + "!";
      celebrate.appendChild(title);

      var sub = document.createElement("p");
      sub.className = "sm-review-sub";
      sub.textContent = "Leave us a quick review \u2014 it only takes 30 seconds \u2B50";
      celebrate.appendChild(sub);

      popup.appendChild(celebrate);

      var actions = document.createElement("div");
      actions.className = "sm-review-actions";

      var yesBtn = document.createElement("button");
      yesBtn.className = "sm-review-yes";
      yesBtn.textContent = "\u2B50 Leave a Review";
      yesBtn.addEventListener("click", onReview);

      var dismissBtn = document.createElement("button");
      dismissBtn.className = "sm-review-dismiss";
      dismissBtn.textContent = "Maybe later";
      dismissBtn.addEventListener("click", onDismiss);

      actions.appendChild(yesBtn);
      actions.appendChild(dismissBtn);
      popup.appendChild(actions);

    } else if (trigger === "order_tracking") {
      // ── Version 2: Sentiment Gate ─────────────────────────────────────────
      popup.className = "sm-review-popup";

      var p2 = document.createElement("p");
      p2.style.cssText = "margin:0 0 4px;font-weight:600;color:#111827;font-size:13px;";
      p2.textContent = "How was your experience?";
      popup.appendChild(p2);

      var sentLabel = document.createElement("div");
      sentLabel.className = "sm-review-sentiment-label";
      sentLabel.textContent = "Tap a reaction to share feedback";
      popup.appendChild(sentLabel);

      var sentRow = document.createElement("div");
      sentRow.className = "sm-review-sentiment";

      var emojis = [
        { icon: "\uD83D\uDE0A", label: "Love it", positive: true },   // 😊
        { icon: "\uD83D\uDE10", label: "It\u2019s okay", positive: false }, // 😐
        { icon: "\uD83D\uDE1F", label: "Not great", positive: false }, // 😟
      ];

      emojis.forEach(function(e) {
        var btn = document.createElement("button");
        btn.title = e.label;
        btn.textContent = e.icon;
        btn.addEventListener("click", function() {
          if (e.positive) {
            // Route to review link
            onReview();
          } else {
            // Just dismiss — they didn't have a great experience
            onDismiss();
          }
        });
        sentRow.appendChild(btn);
      });

      popup.appendChild(sentRow);

      var dismissBtn2 = document.createElement("button");
      dismissBtn2.className = "sm-review-dismiss";
      dismissBtn2.style.cssText = "display:block;width:100%;margin-top:6px;";
      dismissBtn2.textContent = "Skip";
      dismissBtn2.addEventListener("click", onDismiss);
      popup.appendChild(dismissBtn2);

    } else {
      // ── Version 3: Small persistent banner ────────────────────────────────
      popup.className = "sm-review-popup sm-review-banner";
      popup.style.position = "relative"; // override absolute for inline layout

      var xBtn = document.createElement("button");
      xBtn.className = "sm-review-banner-dismiss";
      xBtn.textContent = "\u00D7"; // ×
      xBtn.setAttribute("aria-label", "Dismiss");
      xBtn.addEventListener("click", onDismiss);
      popup.appendChild(xBtn);

      var bannerText = document.createElement("p");
      bannerText.style.cssText = "margin:0 20px 8px 0;color:#374151;";
      bannerText.textContent = "Enjoying ShopMate? A quick review helps \u2B50";
      popup.appendChild(bannerText);

      var bannerBtn = document.createElement("button");
      bannerBtn.className = "sm-review-yes";
      bannerBtn.textContent = "Leave a Review";
      bannerBtn.addEventListener("click", onReview);
      popup.appendChild(bannerBtn);
    }

    // Anchor popup above the bubble
    widget.style.position = "relative";
    widget.appendChild(popup);
  }

  // ── Toggle ────────────────────────────────────────────────────────────────
  function togglePanel() {
    isOpen = !isOpen;
    bubble.innerHTML = isOpen ? iconX : iconChat;
    if (isOpen) {
      panel.classList.remove("sm-hidden");
      inputEl.focus();
    } else {
      panel.classList.add("sm-hidden");
    }
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
    header.innerHTML = `
      <div class="sm-header-icon">${iconChat}</div>
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
