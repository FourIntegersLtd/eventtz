import type { NextConfig } from "next";

/**
 * Next.js config for `web/`.
 *
 * The browser always calls the same-origin `/api/v1/*` path (see
 * `foundation/platform-client/client.ts`); in dev that is proxied here to the
 * local `api/` service so no CORS setup is needed. `PLATFORM_API_URL` (server
 * side) and `NEXT_PUBLIC_PLATFORM_API_URL` (documented for SSR/tooling) both
 * default to the local `api/` on :8001.
 */

const DEFAULT_API_ORIGIN = "http://127.0.0.1:8001";

function resolveApiOrigin(): string {
  const raw = (process.env.PLATFORM_API_URL ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL)?.replace(
    /\/+$/,
    "",
  );
  return raw || DEFAULT_API_ORIGIN;
}

const apiOrigin = resolveApiOrigin();

const nextConfig: NextConfig = {
  trailingSlash: false,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/v1/:path*",
          destination: `${apiOrigin}/api/v1/:path*`,
        },
      ],
    };
  },
  async redirects() {
    // An open help-hub thread's back link targets `{portal}/help/messages`,
    // which has no page of its own; the inbox lives on the hub root.
    return [
      { source: "/client/help/messages", destination: "/client/help", permanent: false },
      { source: "/vendor/help/messages", destination: "/vendor/help", permanent: false },
      { source: "/vendor/onboarding", destination: "/vendor/profile", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
