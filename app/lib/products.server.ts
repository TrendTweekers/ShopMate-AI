/**
 * Server-side product fetching using stored access tokens
 *
 * This module handles fetching products from Shopify Admin API using the
 * merchant's offline access token stored in the Session table. Kept in a
 * .server.ts file so Prisma and server-only code are properly isolated.
 */
import prisma from "~/db.server";

export interface ProductNode {
  id: string;
  handle: string;
  title: string;
  price: string;
  image: string | null;
  url: string;
}

export interface ProductFetchResult {
  context: string;
  products: ProductNode[];
  error?: string;
}

/**
 * Fetch products for a shop using the stored offline access token
 * @param shopDomain - The shop domain (e.g., "example.myshopify.com")
 * @param query - Product search query (e.g., "running shoes", "status:active")
 * @returns Product results with context for AI injection
 */
export async function fetchProductsForShop(
  shopDomain: string,
  query: string,
): Promise<ProductFetchResult> {
  console.log(`[products.server] Fetching products for shop "${shopDomain}" with query: "${query}"`);

  try {
    // Step 1: Look up the offline access token from the Session table
    const session = await prisma.session.findFirst({
      where: { shop: shopDomain, isOnline: false },
    });

    if (!session?.accessToken) {
      console.warn("[products.server] No offline session token found for shop:", shopDomain);
      return {
        context: `PRODUCT_ACCESS_ERROR: No offline session token found — app needs reinstall`,
        products: [],
        error: "no_offline_token",
      };
    }

    console.log("[products.server] Found offline session token for shop:", shopDomain);

    // Step 2: Use the access token to call Shopify Admin API directly
    // Build the products query — only include query parameter if provided
    const gqlQuery = query
      ? `products(first: 5, query: ${JSON.stringify(query)})`
      : `products(first: 5)`;

    const response = await fetch(
      `https://${shopDomain}/admin/api/2025-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({
          query: `{
            ${gqlQuery} {
              edges {
                node {
                  id
                  title
                  handle
                  onlineStoreUrl
                  priceRangeV2 {
                    minVariantPrice {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }`,
        }),
      },
    );

    const json = (await response.json()) as {
      errors?: Array<{ message: string }>;
      data?: {
        products?: {
          edges?: Array<{
            node?: {
              id?: string;
              title?: string;
              handle?: string;
              onlineStoreUrl?: string | null;
              priceRangeV2?: { minVariantPrice?: { amount?: string; currencyCode?: string } };
            };
          }>;
        };
      };
    };

    // Check for GraphQL-level errors
    if (json.errors?.length) {
      const errMsg = json.errors.map((e) => e.message).join("; ");
      console.error("[products.server] GraphQL errors:", errMsg);
      const isScopeError = /access denied|read_products|unauthorized|forbidden/i.test(errMsg);
      const reason = isScopeError
        ? "missing scope read_products — app needs reinstall"
        : errMsg;
      return {
        context: `PRODUCT_ACCESS_ERROR: ${reason}`,
        products: [],
        error: reason,
      };
    }

    const edges = json?.data?.products?.edges ?? [];
    const nodes = edges.map((e) => e.node).filter((n): n is NonNullable<typeof n> => n != null);
    console.log(`[products.server] Returned ${nodes.length} product(s) for query "${query}"`);

    if (!nodes.length) {
      return {
        context: `PRODUCT_EMPTY: 0 products returned for query "${query}". Store may have no active products or the query returned no matches.`,
        products: [],
        error: `0 products returned for query "${query}"`,
      };
    }

    const products: ProductNode[] = nodes.map((p) => {
      const price = p.priceRangeV2?.minVariantPrice;
      const amount = price?.amount ? parseFloat(price.amount).toFixed(2) : "0.00";
      const productUrl = p.onlineStoreUrl || `https://${shopDomain}/products/${p.handle ?? ""}`;
      return {
        id: p.id ?? "",
        handle: p.handle ?? "",
        title: p.title ?? "Product",
        price: `${price?.currencyCode ?? "USD"} ${amount}`,
        image: null,
        url: productUrl,
      };
    });

    return {
      context: `RECOMMENDED PRODUCTS:\n${products.map((p) => `- ${p.title} at ${p.price}`).join("\n")}`,
      products,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[products.server] Exception fetching products:", msg);
    return {
      context: `PRODUCT_EXCEPTION: ${msg}`,
      products: [],
      error: msg,
    };
  }
}
