import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully dynamic: dataset file, search params, and the as-of clock.
  // Cache Components left off so a missing record is a 404 document.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
