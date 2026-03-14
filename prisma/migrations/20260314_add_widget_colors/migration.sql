-- Add widget color customization fields to ShopSettings
-- All columns have defaults so existing rows are populated immediately.

ALTER TABLE "ShopSettings"
  ADD COLUMN IF NOT EXISTS "headerBgColor"   TEXT NOT NULL DEFAULT '#008060',
  ADD COLUMN IF NOT EXISTS "headerTextColor" TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS "bubbleBgColor"   TEXT NOT NULL DEFAULT '#008060',
  ADD COLUMN IF NOT EXISTS "bubbleTextColor" TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS "buttonBgColor"   TEXT NOT NULL DEFAULT '#008060',
  ADD COLUMN IF NOT EXISTS "buttonTextColor" TEXT NOT NULL DEFAULT '#ffffff';
