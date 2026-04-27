import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@bags/shared",
    "@bags/bags-client",
    "@bags/attribution-engine",
    "@bags/risk-engine",
  ],
};

export default nextConfig;
