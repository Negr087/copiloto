import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep server-only packages out of the bundle: Mastra and the Claude Code
  // provider use Node APIs / spawn a subprocess and must run un-bundled.
  serverExternalPackages: [
    "@mastra/core",
    "@mastra/ai-sdk",
    "ai-sdk-provider-claude-code",
    "@anthropic-ai/claude-agent-sdk",
  ],
};

export default nextConfig;
