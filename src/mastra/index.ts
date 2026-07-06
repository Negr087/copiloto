import { Mastra } from '@mastra/core/mastra';
import { assistant } from './agents/assistant';
import { payAndPostWorkflow } from './workflows/pay-and-post';

/**
 * The Mastra instance. `pnpm playground` (mastra dev) reads THIS file and
 * exposes everything registered here in the Studio at http://localhost:4111.
 * Agents and workflows are keyed objects (not arrays).
 */
export const mastra = new Mastra({
  agents: { assistant },
  workflows: { payAndPostWorkflow },
});
