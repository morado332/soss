import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Self-contained server bundle (used for the offline Termux package on Android)
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // SQL migrations are read at runtime (src/startup.ts) — make sure serverless bundles (e.g. Vercel) include them.
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
  outputFileTracingIncludes: { "/*": ["./drizzle/**/*"], "/**/*": ["./drizzle/**/*"] },
};

export default nextConfig;
