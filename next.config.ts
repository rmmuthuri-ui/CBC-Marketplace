import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use a dedicated build directory to avoid OneDrive file-lock issues on `.next`.
  distDir: ".next-build",
};

export default nextConfig;
