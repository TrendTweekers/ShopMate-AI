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
 * authenticate.admin() throws a raw Response (302 redirect to /auth) on first
 * load before a session token exists.  We must NOT swallow that redirect —
 * we need to re-throw it so React Router's own error-handling forwards the
 * browser to the OAuth URL.
 *
 * Two cases to re-throw (let React Router handle natively):
 *  1. Raw Response objects (redirects from authenticate.admin())
 *  2. React Router ErrorResponse objects (isRouteErrorResponse)
 *
 * Only render an error UI for genuine JS errors (Error instances).
 */
export function ErrorBoundary() {
  const error = useRouteError();

  // Case 1: Raw Response thrown by authenticate.admin() (e.g. 302 → /auth)
  // Re-throwing a Response lets React Router execute the redirect natively.
  if (error instanceof Response) {
    throw error;
  }

  // Case 2: React Router ErrorResponse (4xx/5xx route errors)
  // Re-throwing lets React Router render its own 404/error page.
  if (isRouteErrorResponse(error)) {
    throw error;
  }

  // Genuine JS errors — render a minimal page that still loads App Bridge
  // so Shopify's automated checker can detect the script tag.
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
