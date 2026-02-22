-- Migration: kb_drop_unique_add_type_index
-- The @@unique([shop, type]) constraint prevents merchants from adding more
-- than one custom KB entry (all custom entries share type="custom").
-- Policy deduplication is now handled at the application layer (findFirst + update/create).

-- Drop unique constraint, replace with a plain index.
-- The unique index name Prisma generates is "KnowledgeBase_shop_type_key".
DROP INDEX IF EXISTS "KnowledgeBase_shop_type_key";

-- Add plain composite index for type lookups (if not already present).
CREATE INDEX IF NOT EXISTS "KnowledgeBase_shop_type_idx"
  ON "KnowledgeBase"("shop", "type");
