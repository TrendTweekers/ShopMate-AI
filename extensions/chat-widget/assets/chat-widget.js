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
  // Always relative so Shopify's proxy adds the HMAC signature.
  // API_BASE is "" — kept for backward compat if someone sets it.
  const API_URL = API_BASE + "/apps/shopmate/chat";

  console.log("[ShopMate] Initialising. API_URL:", API_URL, "| SHOP:", SHOP);

  // ── State ──────────────────────────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  let conversationId = sessionStorage.getItem(SESSION_KEY) || null;
  let messages = [{ role: "bot", text: GREETING }];

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

  // ── Render helpers ────────────────────────────────────────────────────────
  function msgHtml(msg) {
    if (msg.loading) {
      return `<div class="sm-msg-row bot"><div class="sm-typing"><div class="sm-dot"></div><div class="sm-dot"></div><div class="sm-dot"></div></div></div>`;
    }
    const cls = msg.role === "user" ? "user" : (msg.error ? "error" : "bot");
    let html = `<div class="sm-msg-row ${msg.role === "user" ? "user" : ""}"><div class="sm-bubble ${cls}">${escHtml(msg.text)}</div></div>`;
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
        if (!res.ok) {
          return res.json().then(function(body) {
            console.error("[ShopMate] Error body:", JSON.stringify(body));
            throw new Error("HTTP " + res.status + (body.debug ? " — " + body.debug : ""));
          }).catch(function() {
            throw new Error("HTTP " + res.status);
          });
        }
        return res.json();
      })
      .then(function(data) {
        console.log("[ShopMate] Reply received:", data.reply && data.reply.slice(0, 60));
        if (data.conversationId) {
          conversationId = data.conversationId;
          sessionStorage.setItem(SESSION_KEY, conversationId);
        }
        messages.push({ role: "bot", text: data.reply, products: data.products });
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
