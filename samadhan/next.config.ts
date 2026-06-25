import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Run: minimal self-contained server (Dockerfile copies .next/standalone).
  output: "standalone",
  // Native/server-only packages that must not be bundled for the client.
  serverExternalPackages: ["firebase-admin"],
  async headers() {
    return [
      {
        // Camera / geolocation / mic are used by the capture flow (C2+).
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=(self)",
          },
        ],
      },
      {
        // Service worker must be served fresh and allowed to control the root scope.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "text/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
