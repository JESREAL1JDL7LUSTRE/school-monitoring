import type { NextConfig } from "next";

const config: NextConfig = {
  agentRules: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default config;
