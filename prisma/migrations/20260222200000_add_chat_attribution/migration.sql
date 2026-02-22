-- Migration: add_chat_attribution
-- Tracks product card clicks in chat and revenue attribution via ORDERS_CREATE webhook.

CREATE TABLE IF NOT EXISTS "ChatAttribution" (
  "id"                TEXT NOT NULL PRIMARY KEY,
  "shop"              TEXT NOT NULL,
  "conversationId"    TEXT NOT NULL,
  "productId"         TEXT NOT NULL,
  "productHandle"     TEXT NOT NULL DEFAULT '',
  "productTitle"      TEXT NOT NULL DEFAULT '',
  "clickedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "orderId"           TEXT,
  "orderValue"        DOUBLE PRECISION,
  "attributedRevenue" DOUBLE PRECISION,
  "attributedAt"      TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "ChatAttribution_shop_clickedAt_idx"
  ON "ChatAttribution"("shop", "clickedAt");

CREATE INDEX IF NOT EXISTS "ChatAttribution_shop_attributedAt_idx"
  ON "ChatAttribution"("shop", "attributedAt");

CREATE INDEX IF NOT EXISTS "ChatAttribution_conversationId_idx"
  ON "ChatAttribution"("conversationId");
