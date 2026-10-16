import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  // Same-origin /api/v1 → api/ is a route handler (app/api/v1/[...path]/route.ts),
  // not a rewrite: it turns the session cookies into the Bearer token api/ expects.
  async redirects() {
    return [
      {
        source: "/admin/reset-password",
        destination: "/reset-password?portal=admin",
        permanent: false,
      },
      {
        source: "/admin/forgot-password",
        destination: "/forgot-password?portal=admin",
        permanent: false,
      },
      // Legacy admin index + tab aliases
      {
        source: "/admin",
        destination: "/admin/dashboard",
        permanent: false,
      },
      {
        source: "/admin/vendors",
        destination: "/admin/directory?tab=vendors",
        permanent: false,
      },
      {
        source: "/admin/clients",
        destination: "/admin/directory?tab=clients",
        permanent: false,
      },
      {
        source: "/admin/bookings",
        destination: "/admin/commerce?tab=bookings",
        permanent: false,
      },
      {
        source: "/admin/financials",
        destination: "/admin/commerce?tab=financials",
        permanent: false,
      },
      {
        source: "/admin/disputes",
        destination: "/admin/trust?tab=disputes",
        permanent: false,
      },
      {
        source: "/admin/reviews",
        destination: "/admin/trust?tab=reviews",
        permanent: false,
      },
      {
        source: "/admin/chat",
        destination: "/admin/trust?tab=disputes",
        permanent: false,
      },
      // Admin login — preserve ?next= or default to admin dashboard
      {
        source: "/admin/login",
        has: [{ type: "query", key: "next" }],
        destination: "/login",
        permanent: false,
      },
      {
        source: "/admin/login",
        destination: "/login?next=/admin/dashboard",
        permanent: false,
      },
      // Unified auth aliases
      {
        source: "/client/login",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/client/register",
        destination: "/register?type=client",
        permanent: false,
      },
      {
        source: "/vendor/login",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/vendor/register",
        destination: "/register?type=vendor",
        permanent: false,
      },
      {
        source: "/vendor/onboarding",
        destination: "/vendor/profile",
        permanent: false,
      },
      // Marketplace + help bookmarks
      {
        source: "/explore",
        destination: "/client/browse",
        permanent: false,
      },
      {
        source: "/client/messages",
        destination: "/client/help",
        permanent: false,
      },
      {
        source: "/client/messages/:conversationId",
        destination: "/client/help/messages/:conversationId",
        permanent: false,
      },
      {
        source: "/client/contact",
        destination: "/client/help?tab=contact",
        permanent: false,
      },
      {
        source: "/vendor/messages",
        destination: "/vendor/help",
        permanent: false,
      },
      {
        source: "/vendor/messages/:conversationId",
        destination: "/vendor/help/messages/:conversationId",
        permanent: false,
      },
      {
        source: "/vendor/contact",
        destination: "/vendor/help?tab=contact",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/videos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "four-integers-ltd-09",
  project: process.env.SENTRY_PROJECT || "eventtz-frontend",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
