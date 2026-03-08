import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow requests from Electron (which sends Origin: null or a file:// origin)
  allowedDevOrigins: ["null", "localhost"],
};

export default nextConfig;
