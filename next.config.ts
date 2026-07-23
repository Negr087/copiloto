import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep server-only packages out of the bundle: the Claude Code provider
  // uses Node APIs / spawns a subprocess and must run un-bundled.
  serverExternalPackages: [
    "ai-sdk-provider-claude-code",
    "@anthropic-ai/claude-agent-sdk",
    // Native addon (PTY for the /setup Claude connect flow) — must not be bundled.
    "node-pty",
  ],
};

export default nextConfig;
