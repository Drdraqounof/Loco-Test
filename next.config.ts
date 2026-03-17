import type { NextConfig } from "next";

// In plain terms: this file tells Next.js how this app should behave at build and runtime.

const nextConfig: NextConfig = {
  // Allow requests from Electron (which sends Origin: null or a file:// origin)
  allowedDevOrigins: ["null", "localhost"],
  // Keep Turbopack rooted in the app folder so it resolves local dependencies correctly.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
