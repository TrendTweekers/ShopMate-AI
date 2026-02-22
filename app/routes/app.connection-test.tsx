/**
 * /app/connection-test — Admin Connection Test page
 *
 * Shows at a glance whether the app can access products and orders
 * via the Admin GraphQL API. Also surfaces the currently granted scopes.
 *
 * Useful when diagnosing "widget says no access to products" issues.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { authenticate } from "~/shopify.server";

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const TEST_PRODUCTS_QUERY = `#graphql
  query TestProducts {
    products(first: 5, query: "status:active", sortKey: BEST_SELLING) {
      nodes {
        id
        title
        status
        priceRangeV2 { minVariantPrice { amount currencyCode } }
      }
    }
  }
`;

const TEST_ORDERS_QUERY = `#graphql
  query TestOrders {
    orders(first: 1) {
      nodes {
        id
        name
        displayFinancialStatus
        displayFulfillmentStatus
      }
    }
  }
`;

const SHOP_QUERY = `#graphql
  query ShopInfo {
    shop {
      name
      myshopifyDomain
    }
    appInstallation {
      accessScopes { handle }
    }
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductNode {
  id: string;
  title: string;
  status: string;
  priceRangeV2?: { minVariantPrice?: { amount?: string; currencyCode?: string } };
}

interface OrderNode {
  id: string;
  name: string;
  displayFinancialStatus?: string;
  displayFulfillmentStatus?: string;
}

interface TestResult<T> {
  ok: boolean;
  count?: number;
  sample?: T[];
  error?: string;
  graphqlErrors?: string[];
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // ── Products test ──────────────────────────────────────────────────────────
  const productsResult: TestResult<ProductNode> = await (async () => {
    try {
      const res = await admin.graphql(TEST_PRODUCTS_QUERY);
      const json = (await res.json()) as {
        errors?: Array<{ message: string }>;
        data?: { products?: { nodes?: ProductNode[] } };
      };
      if (json.errors?.length) {
        const msgs = json.errors.map((e) => e.message);
        console.error("[connection-test] Products GraphQL errors:", msgs);
        return { ok: false, graphqlErrors: msgs };
      }
      const nodes = json.data?.products?.nodes ?? [];
      console.log(`[connection-test] Products: ${nodes.length} returned`);
      return { ok: true, count: nodes.length, sample: nodes };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[connection-test] Products exception:", msg);
      return { ok: false, error: msg };
    }
  })();

  // ── Orders test ────────────────────────────────────────────────────────────
  const ordersResult: TestResult<OrderNode> = await (async () => {
    try {
      const res = await admin.graphql(TEST_ORDERS_QUERY);
      const json = (await res.json()) as {
        errors?: Array<{ message: string }>;
        data?: { orders?: { nodes?: OrderNode[] } };
      };
      if (json.errors?.length) {
        const msgs = json.errors.map((e) => e.message);
        console.error("[connection-test] Orders GraphQL errors:", msgs);
        return { ok: false, graphqlErrors: msgs };
      }
      const nodes = json.data?.orders?.nodes ?? [];
      console.log(`[connection-test] Orders: ${nodes.length} returned`);
      return { ok: true, count: nodes.length, sample: nodes };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[connection-test] Orders exception:", msg);
      return { ok: false, error: msg };
    }
  })();

  // ── Shop info + scopes ─────────────────────────────────────────────────────
  let shopName = shop;
  let grantedScopes: string[] = [];

  try {
    const res = await admin.graphql(SHOP_QUERY);
    const json = (await res.json()) as {
      errors?: Array<{ message: string }>;
      data?: {
        shop?: { name?: string; myshopifyDomain?: string };
        appInstallation?: { accessScopes?: Array<{ handle: string }> };
      };
    };
    if (!json.errors?.length) {
      shopName = json.data?.shop?.name ?? shop;
      grantedScopes = json.data?.appInstallation?.accessScopes?.map((s) => s.handle) ?? [];
    }
  } catch (err) {
    console.warn("[connection-test] Could not fetch shop info:", err);
  }

  return {
    shop,
    shopName,
    grantedScopes,
    productsResult,
    ordersResult,
    testedAt: new Date().toISOString(),
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConnectionTest() {
  const { shop, shopName, grantedScopes, productsResult, ordersResult, testedAt } =
    useLoaderData<typeof loader>();
  const { revalidate, state } = useRevalidator();

  const loading = state === "loading";

  const hasReadProducts = grantedScopes.includes("read_products");
  const hasReadOrders   = grantedScopes.includes("read_orders");

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "#111827" }}>
          🔌 Connection Test
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Verifies that ShopMate can access Shopify data for <strong>{shopName}</strong> ({shop}).
          Run this whenever the chat widget reports "no access" errors.
        </p>
      </div>

      {/* Refresh button */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => revalidate()}
          disabled={loading}
          style={{
            padding: "7px 16px", borderRadius: 8, background: "#008060", color: "#fff",
            fontSize: 13, fontWeight: 600, border: "none", cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Testing…" : "↻ Re-run tests"}
        </button>
        <span style={{ marginLeft: 12, fontSize: 12, color: "#9ca3af" }}>
          Last tested: {new Date(testedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Scopes card */}
      <Section title="Granted Scopes">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {grantedScopes.length === 0 ? (
            <Tag color="red">No scopes detected — reinstall required</Tag>
          ) : (
            grantedScopes.map((s) => (
              <Tag key={s} color={s === "read_products" || s === "read_orders" ? "green" : "gray"}>
                {s}
              </Tag>
            ))
          )}
        </div>
        {(!hasReadProducts || !hasReadOrders) && (
          <div style={{ marginTop: 10, padding: "10px 14px", background: "#fff7ed", border: "1px solid #f97316", borderRadius: 8, fontSize: 13, color: "#9a3412" }}>
            <strong>⚠️ Missing required scopes:</strong>{" "}
            {[!hasReadProducts && "read_products", !hasReadOrders && "read_orders"].filter(Boolean).join(", ")}.
            {" "}The app must be <strong>reinstalled</strong> to grant the new scopes.
            After reinstall, run these tests again.
          </div>
        )}
      </Section>

      {/* Products card */}
      <Section title="Product Catalog Access">
        <StatusRow
          label="read_products scope granted"
          ok={hasReadProducts}
          okText="Yes"
          failText="No — reinstall app"
        />
        <StatusRow
          label="GraphQL query succeeded"
          ok={productsResult.ok}
          okText="Yes"
          failText="No"
        />
        {productsResult.ok && (
          <StatusRow
            label="Active products accessible"
            ok={(productsResult.count ?? 0) > 0}
            okText={`${productsResult.count} product(s) returned`}
            failText="0 products — store may have no active products"
          />
        )}
        {productsResult.graphqlErrors && (
          <ErrorBox errors={productsResult.graphqlErrors} />
        )}
        {productsResult.error && (
          <ErrorBox errors={[productsResult.error]} />
        )}
        {productsResult.ok && productsResult.sample && productsResult.sample.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 6px" }}>Sample products returned:</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px", color: "#6b7280", fontWeight: 500 }}>Title</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", color: "#6b7280", fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: "right", padding: "4px 8px", color: "#6b7280", fontWeight: 500 }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {productsResult.sample.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "5px 8px" }}>{p.title}</td>
                    <td style={{ padding: "5px 8px", color: p.status === "ACTIVE" ? "#008060" : "#6b7280" }}>{p.status}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right" }}>
                      {p.priceRangeV2?.minVariantPrice
                        ? `${p.priceRangeV2.minVariantPrice.currencyCode} ${parseFloat(p.priceRangeV2.minVariantPrice.amount ?? "0").toFixed(2)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Orders card */}
      <Section title="Order Lookup Access">
        <StatusRow
          label="read_orders scope granted"
          ok={hasReadOrders}
          okText="Yes"
          failText="No — reinstall app"
        />
        <StatusRow
          label="GraphQL query succeeded"
          ok={ordersResult.ok}
          okText="Yes"
          failText="No"
        />
        {ordersResult.ok && (
          <StatusRow
            label="Orders accessible"
            ok={true}
            okText={ordersResult.count === 0 ? "Yes (store has no orders yet)" : `Yes — most recent: ${ordersResult.sample?.[0]?.name ?? "unknown"}`}
            failText="No"
          />
        )}
        {ordersResult.graphqlErrors && (
          <ErrorBox errors={ordersResult.graphqlErrors} />
        )}
        {ordersResult.error && (
          <ErrorBox errors={[ordersResult.error]} />
        )}
      </Section>

      {/* Instructions */}
      <Section title="How to fix access issues">
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#374151", lineHeight: 1.8 }}>
          <li>In <strong>Shopify Admin</strong>, go to <em>Apps → ShopMate AI → ⋯ → Uninstall</em>.</li>
          <li>Reinstall the app from your Partner Dashboard or the Shopify App Store listing.</li>
          <li>During install, click <strong>Install</strong> on the permissions page to grant the updated scopes.</li>
          <li>Return to this page and click <strong>Re-run tests</strong> to confirm all checks pass.</li>
        </ol>
        <p style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>
          Scope changes (like adding <code>read_products</code> or <code>read_orders</code> to
          <code> shopify.app.toml</code>) only take effect after the merchant reinstalls the app.
          The scopes shown above are what the current install has actually granted.
        </p>
      </Section>

    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 16,
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", color: "#111827" }}>{title}</h2>
      {children}
    </div>
  );
}

function StatusRow({ label, ok, okText, failText }: { label: string; ok: boolean; okText: string; failText: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 13, borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ fontSize: 16 }}>{ok ? "✅" : "❌"}</span>
      <span style={{ flex: 1, color: "#374151" }}>{label}</span>
      <span style={{ color: ok ? "#008060" : "#b91c1c", fontWeight: 500 }}>{ok ? okText : failText}</span>
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: "green" | "red" | "gray" }) {
  const colors = {
    green: { background: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
    red:   { background: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
    gray:  { background: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
  };
  const c = colors[color];
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 500,
      background: c.background,
      color: c.color,
      border: `1px solid ${c.border}`,
    }}>
      {children}
    </span>
  );
}

function ErrorBox({ errors }: { errors: string[] }) {
  return (
    <div style={{ marginTop: 8, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#b91c1c" }}>
      <strong>Error details:</strong>
      <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
        {errors.map((e, i) => <li key={i}>{e}</li>)}
      </ul>
    </div>
  );
}
