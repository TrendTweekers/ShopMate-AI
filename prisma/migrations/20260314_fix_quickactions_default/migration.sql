-- Fix quickActions default: "Track order" → "Track my order"
-- Updates the column default AND rewrites existing rows that still hold the old default.

-- 1. Change the column default so new rows get the correct label.
ALTER TABLE "ShopSettings"
  ALTER COLUMN "quickActions"
  SET DEFAULT ARRAY['Track my order', 'Product recommendations', 'Returns & exchanges'];

-- 2. In existing rows, replace the element 'Track order' with 'Track my order'
--    wherever it appears in the array (leave all other elements untouched).
UPDATE "ShopSettings"
SET "quickActions" = array_replace("quickActions", 'Track order', 'Track my order')
WHERE 'Track order' = ANY("quickActions");
