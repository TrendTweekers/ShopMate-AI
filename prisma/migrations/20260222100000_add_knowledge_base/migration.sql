-- CreateTable: KnowledgeBase
CREATE TABLE IF NOT EXISTS "KnowledgeBase" (
  "id"        TEXT NOT NULL,
  "shop"      TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "type"      TEXT NOT NULL DEFAULT 'custom',
  "status"    TEXT NOT NULL DEFAULT 'active',
  "source"    TEXT NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KnowledgeBase_shop_idx" ON "KnowledgeBase"("shop");

-- CreateUniqueIndex: one row per policy type per shop
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeBase_shop_type_key" ON "KnowledgeBase"("shop", "type");
