<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Agents Starter — project rules

Boilerplate for La Crypta's AI AGENTS hackathon (Bots & Automation). Next.js 16 + Mastra + Vercel AI SDK + Lightning (NWC) + Nostr.

## Non-obvious constraints (read before editing deps)

- **Node 22.13+ is required** (`@mastra/core`). Node 20 fails. There is a `.nvmrc` — run `nvm use`.
- **The Vercel AI SDK is pinned to the v6 line** (`ai@6`, `@ai-sdk/react@3`, `@ai-sdk/anthropic@3`). Do NOT bump them to `@latest` — that's v7, and `ai-sdk-provider-claude-code` has no v7 build (it's `@ai-sdk/provider@3` / v6 only). Keeping v6 is load-bearing.
- Package manager is **pnpm** (pinned via `packageManager`). Not npm.

## Two model auth modes — both go through `lib/model.ts` (dynamic)

`lib/model.ts` reads env LAZILY (per request) so credentials saved at runtime take effect without a restart. `assistant.ts` passes `model`/`tools` as functions for the same reason.

- No `ANTHROPIC_API_KEY` → **subscription mode**: `ai-sdk-provider-claude-code`, which spawns the Claude Code CLI. Auth is `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) or a local login; the spawned CLI inherits `process.env`. Node runtime only. **Does not bridge AI SDK / Mastra tools** — Claude Code runs its own.
- `ANTHROPIC_API_KEY` set → **API-key mode**: `@ai-sdk/anthropic` over HTTP. Full tool-calling. Outranks the OAuth token.

## Auth setup flow (`/setup`, dev-only)

`pnpm setup` and the `/setup` page connect Claude by running the **official** `claude setup-token` and writing `CLAUDE_CODE_OAUTH_TOKEN` to `.env` (`lib/claudeToken.ts` + `lib/envFile.ts`). Do NOT add a reverse-engineered OAuth flow — using subscription tokens outside the official CLI violates Anthropic's ToS. Setup routes (`app/api/setup/*`) are gated by `setupEnabled()` (dev-only, hard-403 in production).

Because of the tool-bridging gap, the agent (`src/mastra/agents/assistant.ts`) attaches tools **only in API-key mode**, and the mode-independent tool showcase is the **`pay-and-post` workflow** (calls the lib functions directly).

## Mastra v1 API notes (differs from v0.x and from most training data)

- Tool `execute` is **positional**: `execute: async (inputData, ctx) => {}`.
- Workflow step `execute` **destructures**: `execute: async ({ inputData }) => {}`.
- Agents/workflows are registered as **keyed objects** on `new Mastra({ agents, workflows })`; `mastra dev` reads `src/mastra/index.ts`.
- Stream a Mastra agent to `useChat` via `handleChatStream({ mastra, agentId, params, version: 'v6' })` + `createUIMessageStreamResponse` (from `ai`). There is no `.toDataStreamResponse()`.

## Where things live

- `lib/` — framework-agnostic core (`model`, `lightning`, `nostr`). Keep provider/protocol logic here.
- `src/mastra/tools/` — thin `createTool` wrappers over `lib/`.
- User-facing copy is **Spanish**; identifiers/comments are English; thrown user-facing errors are Spanish on purpose.
- Amounts in `lib/lightning.ts` convert msat↔sat at the boundary — the rest of the app uses **sats**.
