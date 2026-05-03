import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / DB deps: avoid bundling issues on Vercel serverless.
  serverExternalPackages: ["@prisma/client", "prisma", "pg"],
};

export default nextConfig;
