-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN "setupCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "botName" TEXT NOT NULL DEFAULT 'ShopMate',
ADD COLUMN "greeting" TEXT NOT NULL DEFAULT 'Hi! 👋 How can I help you today?',
ADD COLUMN "tone" TEXT NOT NULL DEFAULT 'Friendly',
ADD COLUMN "quickActions" TEXT[] DEFAULT ARRAY['Track order', 'Product recommendations', 'Returns & exchanges'];
