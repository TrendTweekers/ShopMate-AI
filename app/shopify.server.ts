import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { importStorePolicies } from "./lib/importStorePolicies.server";

export const MONTHLY_PLAN = "ShopMate Pro";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    [MONTHLY_PLAN]: {
      lineItems: [
        {
          amount: 39,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  // ── Auto-import store policies on every new install/re-auth ──────────────
  // afterAuth fires once per OAuth flow completion (new install + reinstalls).
  // We import asynchronously so auth completes instantly — failures are logged
  // but never block the merchant from reaching the dashboard.
  hooks: {
    afterAuth: async ({ admin, session }) => {
      if (!admin) return;
      const shop = session.shop;
      console.log(`[afterAuth] Running setup for newly authenticated shop: ${shop}`);

      // ── Auto-enable widget on install ──
      // Check if ShopSettings exists. If not (new install), create with widgetEnabled: true.
      // If it exists (reinstall), don't override existing settings.
      try {
        const existing = await prisma.shopSettings.findUnique({
          where: { shop },
          select: { id: true },
        });

        if (!existing) {
          // New install — auto-create with widget enabled
          await prisma.shopSettings.create({
            data: {
              shop,
              widgetEnabled: true,
              setupCompleted: false,
              lastActiveAt: new Date(),
            },
          });
          console.log(`[afterAuth] ✅ Auto-enabled widget for new install: ${shop}`);
        } else {
          console.log(`[afterAuth] Shop settings already exist, skipping auto-enable: ${shop}`);
        }
      } catch (err) {
        console.error(`[afterAuth] Failed to auto-enable widget for ${shop}:`, err);
      }

      // ── Seed default KB entries for new installs ──
      // Only seeds if the shop has zero existing KB entries so reinstalls
      // don't overwrite anything the merchant has already edited.
      try {
        const kbCount = await prisma.knowledgeBase.count({ where: { shop } });
        if (kbCount === 0) {
          await prisma.knowledgeBase.createMany({
            data: [
              {
                shop,
                title: "Return Policy",
                content:
                  "We offer a 30-day return policy on all items. Items must be unused and in original packaging. To start a return, contact our support team.",
                type: "custom",
                status: "active",
                source: "manual",
              },
              {
                shop,
                title: "Shipping Info",
                content:
                  "We ship within 1-2 business days. Standard shipping takes 5-7 days. Express shipping takes 2-3 days. Free shipping on orders over $50.",
                type: "custom",
                status: "active",
                source: "manual",
              },
              {
                shop,
                title: "Order Changes",
                content:
                  "Orders can be modified or cancelled within 24 hours of placing them. After that, contact us and we'll do our best to help.",
                type: "custom",
                status: "active",
                source: "manual",
              },
              {
                shop,
                title: "Contact Us",
                content:
                  "You can reach our support team by email at support@yourstore.com or through the contact form on our website. We respond within 24 hours.",
                type: "custom",
                status: "active",
                source: "manual",
              },
            ],
          });
          console.log(`[afterAuth] ✅ Seeded 4 default KB entries for new install: ${shop}`);
        } else {
          console.log(`[afterAuth] KB already has ${kbCount} entries, skipping seed: ${shop}`);
        }
      } catch (err) {
        console.error(`[afterAuth] KB seed failed for ${shop}:`, err);
      }

      // ── Import store policies asynchronously ──
      importStorePolicies(shop, admin).catch((err) => {
        console.error(`[afterAuth] Policy import failed for ${shop}:`, err);
      });
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
