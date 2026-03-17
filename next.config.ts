import type { NextConfig } from "next";

// In plain terms: this file tells Next.js how this app should behave at build and runtime.

const nextConfig: NextConfig = {
  // Allow requests from Electron (which sends Origin: null or a file:// origin)
  allowedDevOrigins: ["null", "localhost"],
};

export default nextConfig;
