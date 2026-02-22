import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
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
          Explicit App Bridge CDN script tag — required by Shopify's automated
          review checker ("Using the latest App Bridge script loaded from
          Shopify's CDN"). The AppProvider also loads this at runtime, but
          the checker crawls static HTML so it must be in the server response.
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

/**
 * Root ErrorBoundary
 *
 * IMPORTANT: authenticate.admin() throws a Response when it needs to redirect
 * (e.g. to /auth on first load before a session token exists). If we catch
 * that Response here and render an error page, the auth flow is broken —
 * the merchant sees "Something went wrong" instead of being redirected.
 *
 * Fix: check if the error is a Response. If it is, re-throw it so React
 * Router's own response-handling bubbles it back up as a redirect.
 * Only render the error UI for genuine application errors (Error instances).
 *
 * The "works on refresh" symptom is the exact tell: first load has no token →
 * SDK throws a redirect Response → ErrorBoundary swallows it → shows error.
 * Refresh: Shopify injects a token into the URL → authenticate.admin() succeeds.
 */
export function ErrorBoundary() {
  const error = useRouteError();

  // If the SDK threw a redirect Response (e.g. to /auth), re-throw it so
  // React Router handles the redirect instead of rendering an error page.
  if (isRouteErrorResponse(error)) {
    // isRouteErrorResponse covers 3xx redirects and 4xx/5xx HTTP responses.
    // Re-throwing causes React Router to handle it natively (redirect/404 page).
    throw error;
  }

  // For genuine JS errors, render a minimal error page that still loads
  // App Bridge so Shopify's checker can detect it even on the error path.
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Error — ShopMate AI</title>
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
