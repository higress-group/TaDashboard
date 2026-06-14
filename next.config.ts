import type { NextConfig } from "next";

// Collect allowed dev origins from env or use wildcard pattern for space-z.ai previews
const devOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",")
  : [];

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: devOrigins,
  // NOTE: Global wildcard CORS has been removed. CORS, if required, should be
  // handled per API route or by the ingress/gateway so that authenticated
  // endpoints are not exposed to arbitrary origins.
};

export default nextConfig;
