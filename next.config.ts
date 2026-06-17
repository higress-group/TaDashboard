import type { NextConfig } from "next";

const devOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",")
  : ["*.monkeycode-ai.online"];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  allowedDevOrigins: devOrigins,
  // NOTE: Global wildcard CORS has been removed. CORS, if required, should be
  // handled per API route or by the ingress/gateway so that authenticated
  // endpoints are not exposed to arbitrary origins.
};

export default nextConfig;
