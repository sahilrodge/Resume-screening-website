import type { NextConfig } from "next"

const API_PROXY_TARGET = (
  process.env.API_PROXY_TARGET ||
  "https://api-production-5f0fb.up.railway.app"
).replace(/\/$/, "")

const nextConfig: NextConfig = {
  // Smaller Docker/Railway images; required by frontend/Dockerfile
  output: "standalone",

  // Production hardening
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,

  // Faster cold builds / smaller client bundles
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "framer-motion",
      "@base-ui/react",
    ],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "http", hostname: "localhost" },
    ],
  },

  // Fail CI/build on ESLint issues in production builds when desired
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  // Same-origin browser → Vercel → Railway (avoids cross-origin failures)
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_PROXY_TARGET}/api/v1/:path*`,
      },
    ]
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
}

export default nextConfig
