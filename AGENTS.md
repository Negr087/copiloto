<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Copiloto — project rules

A clipboard daemon: watches what you copy and turns it into an action — pay a Lightning invoice, look up a Nostr profile, decode an LNURL, check a Bitcoin address, or (opt-in, double-copy) hand it to an LLM agent. Built for La Crypta's AI AGENTS hackathon (Bots & Automation track).

## Non-obvious constraints (read before editing deps)

- **Node 22+ is required** (`@getalby/sdk`). There is a `.nvmrc` — run `nvm use`.
- **The Vercel AI SDK is pinned to the v6 line** (`ai@6`, `@ai-sdk/anthropic@3`, `@ai-sdk/openai@3`). Do NOT bump them to `@latest` — that's v7, and `ai-sdk-provider-claude-code` has no v7 build (it's `@ai-sdk/provider@3` / v6 only). Keeping v6 is load-bearing.
- Package manager is **pnpm** (pinned via `packageManager`). Not npm.
- The daemon (`daemon/`) and the web app (`app/`, `lib/`) are two separate processes that share `.env`: the daemon watches the clipboard and acts, `pnpm dev` only serves the feed UI (confirmations + history) and `/setup`. There's no tool-calling or workflow orchestration framework in this project — just two-step `generateText` calls (classify → act) in `daemon/agent/pipeline.ts`.

## Providers — `lib/providers.ts` + `lib/model.ts` (dynamic), and `daemon/agent/model.ts` (self-contained)

Four providers, selected by `AI_PROVIDER` (`subscription` | `anthropic` | `openai` | `gateway`); model by `MODEL_ID` (empty → provider default). To add one, extend the `PROVIDERS` registry in `lib/providers.ts` and add a `case` in `getModel()`. Both read env LAZILY (per call), so config saved at runtime via `/setup` takes effect without a restart.

- `subscription` — `ai-sdk-provider-claude-code`, spawns the Claude Code CLI. Auth = `CLAUDE_CODE_OAUTH_TOKEN`. **Node runtime only.**
- `anthropic` / `openai` — `@ai-sdk/anthropic` / `@ai-sdk/openai` over HTTP.
- `gateway` — Vercel AI Gateway via `createGateway` (re-exported from `ai`). Models are `creator/model` slugs. One key, any provider.

`daemon/agent/model.ts` intentionally duplicates `lib/model.ts`'s resolution logic instead of importing it, so the daemon doesn't depend on the web app's exact signature (see the comment at the top of that file).

## Auth setup flow (`/setup` + `/api/setup/*`, dev-only)

`/setup` picks provider + model + credential → `POST /api/setup/config` writes `AI_PROVIDER`/`MODEL_ID`/the key env var (`lib/envFile.ts`). The "Conectar" button + `pnpm setup` run the **official** `claude setup-token` (`lib/claudeToken.ts`). Do NOT add a reverse-engineered OAuth flow — using subscription tokens outside the official CLI violates Anthropic's ToS. All setup routes are gated by `setupEnabled()` (dev-only, hard-403 in production).

## The daemon (`daemon/`) — where the actual product lives

- `daemon/router.ts` — deterministic regex classifier (BOLT11, NIP-19, LNURL, on-chain BTC address). Zero LLM, zero cost. Whitelist by design: anything that doesn't match is silently ignored, on purpose (privacy) — never add a catch-all here.
- `daemon/handlers/` — one handler per kind the router recognizes, plus `ask.ts` (the LLM fallback).
- `daemon/agent/pipeline.ts` — the only path that reaches an LLM, and only on double-copy: classify intent (`agent/intents.ts`) → act. Adding a capability is adding an entry there.
- `daemon/index.ts` — the watch loop. WSL goes by clipboard-sequence-number events via `winClipboard.ts`; Linux native polls (`CLIP_POLL_MS`) or uses Wayland copy events (`copyEvents.ts`).
- `daemon/pending.ts` + `app/api/pending` + `app/api/feed/stream` — payment confirmations surface in the web feed (SSE), not desktop notifications, when running under WSL.

## Where things live

- `lib/` — framework-agnostic core shared with the web app (`model`, `providers`, `lightning`, `nostr`, setup helpers).
- User-facing copy is **Spanish**; identifiers/comments are English; thrown user-facing errors are Spanish on purpose.
- Amounts in `lib/lightning.ts` convert msat↔sat at the boundary — the rest of the app uses **sats**.
