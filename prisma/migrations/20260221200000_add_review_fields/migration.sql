-- AlterTable: add smart review fields to ShopSettings
ALTER TABLE "ShopSettings"
  ADD COLUMN IF NOT EXISTS "reviewRequestedAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewDismissedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hasReviewed"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "aiHandledChats"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "orderTrackingResolved" INTEGER NOT NULL DEFAULT 0;
