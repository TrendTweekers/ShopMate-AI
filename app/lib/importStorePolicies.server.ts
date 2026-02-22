/**
 * importStorePolicies
 *
 * Fetches all store policies from the Shopify Admin GraphQL API and upserts
 * them into the KnowledgeBase table. Called on app install (afterAuth hook)
 * and can be re-triggered manually from the Knowledge Base page.
 *
 * REQUIRED SCOPE
 * --------------
 * read_legal_policies — must be present in shopify.app.toml [access_scopes]
 * and the merchant must have re-installed / re-authorised the app after the
 * scope was added.  Without it Shopify returns:
 *   "Field 'privacyPolicy' doesn't exist on type 'Shop'"
 *
 * API HISTORY
 * -----------
 * BROKEN (pre-2023):  query { shopPolicies { type title body } }
 *   → shopPolicies was a root-level field that returned ShopPolicy[].
 *   → Removed from the API; causes "Field 'shopPolicies' doesn't exist on
 *     type 'QueryRoot'" on API version 2023-01+.
 *
 * CURRENT (2023-01+):  query { shop { privacyPolicy { title body url }  ... } }
 *   → Each policy is a named field on the Shop object.
 *   → Fields: privacyPolicy, refundPolicy, shippingPolicy,
 *             termsOfService, subscriptionPolicy.
 *   → Each returns ShopPolicy { title: String, body: String, url: String } or null.
 *   → No "type" discriminator — we use the field name instead.
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const SHOP_POLICIES_QUERY = `#graphql
  query GetShopPolicies {
    shop {
      privacyPolicy      { title body url }
      refundPolicy       { title body url }
      shippingPolicy     { title body url }
      termsOfService     { title body url }
      subscriptionPolicy { title body url }
    }
  }
`;

// ─── Policy definitions ───────────────────────────────────────────────────────

// Each entry maps the GraphQL field name → our internal type + display title
const POLICY_DEFS: Array<{
  field: keyof ShopPolicies;
  type: string;
  title: string;
}> = [
  { field: "refundPolicy",       type: "refund_policy",       title: "Return & Refund Policy" },
  { field: "shippingPolicy",     type: "shipping_policy",     title: "Shipping Policy" },
  { field: "privacyPolicy",      type: "privacy_policy",      title: "Privacy Policy" },
  { field: "termsOfService",     type: "terms_of_service",    title: "Terms of Service" },
  { field: "subscriptionPolicy", type: "subscription_policy", title: "Subscription Policy" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface PolicyNode {
  title?: string | null;
  body?: string | null;
  url?: string | null;
}

interface ShopPolicies {
  privacyPolicy?:      PolicyNode | null;
  refundPolicy?:       PolicyNode | null;
  shippingPolicy?:     PolicyNode | null;
  termsOfService?:     PolicyNode | null;
  subscriptionPolicy?: PolicyNode | null;
}

interface GraphQLResponse {
  data?: { shop?: ShopPolicies };
  errors?: Array<{ message: string; locations?: unknown; path?: unknown }>;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  policies: Array<{ title: string; type: string }>;
}

// ─── HTML → plain text ────────────────────────────────────────────────────────

/**
 * Strips HTML tags from a Shopify policy body.
 * Policies are returned as HTML — we convert to plain text for AI context.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<\/?(p|div|li|h[1-6]|br|tr|td|th)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function importStorePolicies(
  shop: string,
  admin: AdminApiContext,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [], policies: [] };

  // ── 1. Fetch from Shopify ─────────────────────────────────────────────────
  let shopPolicies: ShopPolicies = {};

  try {
    const res = await admin.graphql(SHOP_POLICIES_QUERY);
    const json = (await res.json()) as GraphQLResponse;

    // Surface GraphQL-level errors (e.g. missing scope, wrong API version)
    if (json.errors?.length) {
      const msgs = json.errors.map((e) => e.message);
      console.error(`[KnowledgeBase] GraphQL errors for ${shop}:`, msgs);

      // Detect the specific scope-missing error for a clear actionable message
      const isScopeMissing = msgs.some(
        (m) =>
          m.includes("privacyPolicy") ||
          m.includes("refundPolicy") ||
          m.includes("shippingPolicy") ||
          m.includes("termsOfService") ||
          m.includes("subscriptionPolicy") ||
          m.toLowerCase().includes("doesn't exist on type") ||
          m.toLowerCase().includes("access denied") ||
          m.toLowerCase().includes("unauthorized"),
      );

      if (isScopeMissing) {
        result.errors.push(
          "SCOPE_MISSING: Policies not available — the read_legal_policies scope is required. " +
            "Re-install or re-authorise the app from the Shopify Partners Dashboard to grant access.",
        );
      } else {
        result.errors.push(...msgs);
      }
      return result;
    }

    if (!json.data?.shop) {
      result.errors.push(
        "Shopify returned no shop data. Ensure the read_legal_policies scope is granted and re-install the app if needed.",
      );
      return result;
    }

    shopPolicies = json.data.shop;
    console.log(`[KnowledgeBase] Policies fetched for ${shop}:`,
      POLICY_DEFS.map((d) => `${d.field}=${!!(shopPolicies[d.field]?.body)}`).join(" | "),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[KnowledgeBase] Network/parse error for ${shop}:`, msg);
    result.errors.push(`Failed to fetch policies: ${msg}`);
    return result;
  }

  // ── 2. Upsert each policy ─────────────────────────────────────────────────
  for (const def of POLICY_DEFS) {
    const policy = shopPolicies[def.field];

    // Policy field is null → merchant hasn't written it in Shopify yet
    if (!policy) {
      console.log(`[KnowledgeBase] ${def.field} is null (not set in store) — skipping`);
      result.skipped++;
      continue;
    }

    // Prefer the title returned by Shopify; fall back to our display title
    const title = (policy.title ?? "").trim() || def.title;

    const rawBody = policy.body ?? "";
    const plainText = stripHtml(rawBody).trim();

    // Policy exists but has no content — skip with informative log
    if (!plainText) {
      console.log(`[KnowledgeBase] ${def.field} exists but body is empty — skipping`);
      // If there's a URL, store that as minimal content so we have something useful
      if (policy.url) {
        const urlContent = `${title}\n\nFull policy: ${policy.url}`;
        await upsertPolicy(shop, def.type, title, urlContent, result);
      } else {
        result.skipped++;
      }
      continue;
    }

    // Append URL at the end for reference if available
    const content = policy.url
      ? `${plainText}\n\nFull policy: ${policy.url}`
      : plainText;

    await upsertPolicy(shop, def.type, title, content, result);
  }

  console.log(
    `[KnowledgeBase] Import for ${shop}: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`,
  );

  return result;
}

// ─── Helper: upsert one policy entry ─────────────────────────────────────────

async function upsertPolicy(
  shop: string,
  type: string,
  title: string,
  content: string,
  result: ImportResult,
): Promise<void> {
  try {
    // findFirst + update/create: the DB has no unique constraint on (shop, type)
    // since merchants can have multiple custom entries. We match by shop + type
    // for Shopify-imported policies to avoid creating duplicates on re-import.
    const existing = await prisma.knowledgeBase.findFirst({
      where: { shop, type },
    });

    if (existing) {
      await prisma.knowledgeBase.update({
        where: { id: existing.id },
        data: { title, content, status: "active", source: "shopify_import" },
      });
      console.log(`[KnowledgeBase] Updated existing ${type} entry for ${shop}`);
    } else {
      await prisma.knowledgeBase.create({
        data: { shop, title, content, type, status: "active", source: "shopify_import" },
      });
      console.log(`[KnowledgeBase] Created new ${type} entry for ${shop}`);
    }

    result.imported++;
    result.policies.push({ title, type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[KnowledgeBase] Failed to upsert ${type} for ${shop}:`, msg);
    result.errors.push(`Failed to save "${title}": ${msg}`);
  }
}
