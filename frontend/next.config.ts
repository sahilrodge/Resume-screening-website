import type { NextConfig } from "next"

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
    ],
  },

  // Fail CI/build on ESLint issues in production builds when desired
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig
