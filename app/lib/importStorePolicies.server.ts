/**
 * importStorePolicies
 *
 * Fetches all store policies from the Shopify Admin GraphQL API and upserts
 * them into the KnowledgeBase table. Called on app install and can be
 * re-triggered manually from the Knowledge Base page.
 *
 * GraphQL field: shopPolicies — returns an array of ShopPolicy objects.
 * Each object has: type (enum), title, body, url, createdAt, updatedAt.
 *
 * Policy type enum values (as returned by Shopify):
 *   REFUND_POLICY | SHIPPING_POLICY | PRIVACY_POLICY | TERMS_OF_SERVICE
 *   SUBSCRIPTION_POLICY | CONTACT_INFORMATION | LEGAL_NOTICE
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

const SHOP_POLICIES_QUERY = `#graphql
  query GetShopPolicies {
    shopPolicies {
      type
      title
      body
    }
  }
`;

// Map Shopify enum → our internal type string (used as the unique key)
const TYPE_MAP: Record<string, string> = {
  REFUND_POLICY:        "refund_policy",
  SHIPPING_POLICY:      "shipping_policy",
  PRIVACY_POLICY:       "privacy_policy",
  TERMS_OF_SERVICE:     "terms_of_service",
  SUBSCRIPTION_POLICY:  "subscription_policy",
  CONTACT_INFORMATION:  "contact_information",
  LEGAL_NOTICE:         "legal_notice",
};

// Human-readable titles for display in the knowledge base
const TITLE_MAP: Record<string, string> = {
  REFUND_POLICY:        "Return Policy",
  SHIPPING_POLICY:      "Shipping Policy",
  PRIVACY_POLICY:       "Privacy Policy",
  TERMS_OF_SERVICE:     "Terms of Service",
  SUBSCRIPTION_POLICY:  "Subscription Policy",
  CONTACT_INFORMATION:  "Contact Information",
  LEGAL_NOTICE:         "Legal Notice",
};

interface ShopPolicy {
  type: string;
  title: string;
  body: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  policies: Array<{ title: string; type: string }>;
}

/**
 * Strips HTML tags from a Shopify policy body.
 * Policies are stored as HTML — we want plain text for the AI context.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<\/?(p|div|li|h[1-6]|br)[^>]*>/gi, "\n") // block elements → newlines
    .replace(/<[^>]+>/g, "")                             // strip remaining tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")                          // collapse blank lines
    .trim();
}

export async function importStorePolicies(
  shop: string,
  admin: AdminApiContext,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [], policies: [] };

  let policies: ShopPolicy[] = [];
  try {
    const res = await admin.graphql(SHOP_POLICIES_QUERY);
    const json = (await res.json()) as {
      data?: { shopPolicies?: ShopPolicy[] };
      errors?: Array<{ message: string }>;
    };

    if (json.errors?.length) {
      result.errors.push(...json.errors.map((e) => e.message));
      return result;
    }

    policies = json.data?.shopPolicies ?? [];
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }

  for (const policy of policies) {
    const plainText = stripHtml(policy.body ?? "");

    // Skip completely empty policies (merchant hasn't written them yet)
    if (!plainText.trim()) {
      result.skipped++;
      continue;
    }

    const type = TYPE_MAP[policy.type] ?? policy.type.toLowerCase();
    const title = TITLE_MAP[policy.type] ?? policy.title;

    try {
      await prisma.knowledgeBase.upsert({
        where: { shop_type: { shop, type } },
        create: {
          shop,
          title,
          content: plainText,
          type,
          status: "active",
          source: "shopify_import",
        },
        update: {
          // Always refresh content from Shopify so edits there are reflected
          title,
          content: plainText,
          status: "active",
          source: "shopify_import",
        },
      });

      result.imported++;
      result.policies.push({ title, type });
    } catch (err) {
      result.errors.push(
        `Failed to upsert ${type}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `[KnowledgeBase] Import for ${shop}: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`,
  );

  return result;
}
