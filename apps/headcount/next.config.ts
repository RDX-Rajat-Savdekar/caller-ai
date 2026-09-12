import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@caller-ai/core",
    "@caller-ai/reel",
    "@caller-ai/sim",
    "remotion",
    "@remotion/player",
    "@remotion/google-fonts",
  ],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
