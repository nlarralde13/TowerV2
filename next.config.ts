import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@game":       path.resolve(__dirname, "src/game"),
      "@store":      path.resolve(__dirname, "src/store"),
      "@render":     path.resolve(__dirname, "src/render"),
      "@components": path.resolve(__dirname, "src/components"),
    };
    return config;
  },
};

export default nextConfig;
