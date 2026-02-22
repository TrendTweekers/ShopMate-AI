import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import shopmateCss from "./shopmate.css?url";

export function links() {
  return [{ rel: "stylesheet", href: shopmateCss }];
}

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>ShopMate AI</title>
        <link rel="icon" type="image/png" href="/assets/shopmatelogo.png" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
        {/*
          App Bridge CDN script — loaded explicitly so Shopify's automated
          review checker ("Using the latest App Bridge script loaded from
          Shopify's CDN") can detect it in the HTML.
          The @shopify/shopify-app-react-router AppProvider also injects this
          at runtime, but the explicit tag ensures it is present in the
          server-rendered HTML that the checker crawls.
        */}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  return (
    <html>
      <head>
        <title>Error</title>
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </head>
      <body>
        <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
          <h1>Something went wrong</h1>
          <p>Please refresh the page or contact support.</p>
        </div>
      </body>
    </html>
  );
}
