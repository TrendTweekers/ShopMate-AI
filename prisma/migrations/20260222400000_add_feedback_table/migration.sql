-- CreateTable: Feedback
-- Stores merchant feedback submitted via the ShopMate AI dashboard.

CREATE TABLE "Feedback" (
    "id"        TEXT NOT NULL,
    "shop"      TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "email"     TEXT,
    "plan"      TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_shop_idx" ON "Feedback"("shop");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");
