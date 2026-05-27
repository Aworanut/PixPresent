import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      // Cloudflare R2 public buckets (*.r2.dev) + custom domains
      { protocol: "https", hostname: "*.r2.dev" },
      // Custom domain: extracted from R2_PUBLIC_URL at build time
      ...(process.env.R2_PUBLIC_URL &&
      !process.env.R2_PUBLIC_URL.includes(".r2.dev")
        ? [
            {
              protocol: "https" as const,
              hostname: new URL(process.env.R2_PUBLIC_URL).hostname,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
