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

## Providers — `lib/providers.ts` + `lib/model.ts` (dynamic)

Four providers, selected by `AI_PROVIDER` (`subscription` | `anthropic` | `openai` | `gateway`); model by `MODEL_ID` (empty → provider default). To add one, extend the `PROVIDERS` registry in `lib/providers.ts` and add a `case` in `getModel()`. `lib/model.ts` reads env LAZILY (per request) and `assistant.ts` passes `model`/`tools` as functions, so config saved at runtime takes effect without a restart.

- `subscription` — `ai-sdk-provider-claude-code`, spawns the Claude Code CLI. Auth = `CLAUDE_CODE_OAUTH_TOKEN`. **Node runtime only; does NOT bridge Mastra/AI SDK tools.** `getModel()` passes `env` (process.env MINUS `ANTHROPIC_API_KEY`, which would outrank the token) as a per-call `ClaudeCodeSettings`.
- `anthropic` / `openai` — `@ai-sdk/anthropic` / `@ai-sdk/openai` over HTTP.
- `gateway` — Vercel AI Gateway via `createGateway` (re-exported from `ai`). Models are `creator/model` slugs. One key, any provider.

`providerSupportsChatTools()` gates the agent's chat tools (all but subscription).

## Auth setup flow (`/setup` + `/api/setup/*`, dev-only)

`/setup` picks provider + model + credential → `POST /api/setup/config` writes `AI_PROVIDER`/`MODEL_ID`/the key env var (`lib/envFile.ts`). The subscription "Conectar" button + `pnpm setup` run the **official** `claude setup-token` (`lib/claudeToken.ts`). Do NOT add a reverse-engineered OAuth flow — using subscription tokens outside the official CLI violates Anthropic's ToS. All setup routes are gated by `setupEnabled()` (dev-only, hard-403 in production).

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
