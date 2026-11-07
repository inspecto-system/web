import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image (node .next/standalone/server.js).
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // cacheComponents (Partial Prerendering) is deliberately off: pages are rendered per request so
  // that every response carries a fresh CSP nonce (src/proxy.ts). A prerendered static shell would
  // have scripts without the nonce, and the strict policy would block them.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
