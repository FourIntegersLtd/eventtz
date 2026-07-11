import type { NextConfig } from "next";
import { getBackendBaseUrl } from "./lib/backend-url";

const backendUrl = getBackendBaseUrl();

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
  // Same-origin /api/v1 → FastAPI. Keeps auth cookies first-party (fixes mobile Chrome/Safari).
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
