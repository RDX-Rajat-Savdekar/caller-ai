import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@caller-ai/core",
    "@caller-ai/reel",
    "remotion",
    "@remotion/player",
    "@remotion/google-fonts",
  ],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
