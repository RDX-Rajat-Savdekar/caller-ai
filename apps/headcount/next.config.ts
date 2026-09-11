import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@caller-ai/core", "@caller-ai/reel"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
