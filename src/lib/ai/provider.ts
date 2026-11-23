// One interface for every AI provider. The command route doesn't care which
// model answers — it gets back text plus proposed tool calls.
import "server-only";
import type { ToolDef } from "./tools";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ProviderRequest {
  system: string;
  messages: ChatTurn[];
  tools: ToolDef[];
  /**
   * Read-only tools the server runs itself mid-answer (e.g. searching lesson
   * plans). Return a JSON-able result. Other tool calls are returned as
   * proposals for the user to confirm.
   */
  serverTools?: Record<string, (input: Record<string, unknown>) => Promise<unknown>>;
}

/** How many search rounds the model may do before it must answer. */
export const MAX_SERVER_ROUNDS = 3;

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface ProviderResult {
  text: string;
  calls: ToolCall[];
}

export type ProviderErrorCode = "no_key" | "bad_key" | "rate_limited" | "refused" | "failed";

export class ProviderError extends Error {
  constructor(
    message: string,
    public code: ProviderErrorCode,
  ) {
    super(message);
  }
}

export interface Provider {
  id: "gemini" | "anthropic";
  label: string;
  run(req: ProviderRequest): Promise<ProviderResult>;
}

/** AI_PROVIDER wins; otherwise use whichever key is set (Gemini first, since it's free). */
export async function getProvider(): Promise<Provider> {
  const choice = process.env.AI_PROVIDER?.toLowerCase();
  if (choice === "anthropic" || (!choice && !process.env.GEMINI_API_KEY && process.env.ANTHROPIC_API_KEY)) {
    return (await import("./providers/anthropic")).anthropic;
  }
  return (await import("./providers/gemini")).gemini;
}

/**
 * Fill in properties the model left out with null, so every action has the
 * full shape the app expects (some providers drop optional fields).
 */
export function normalizeInput(def: ToolDef | undefined, input: Record<string, unknown>) {
  if (!def) return input;
  const out: Record<string, unknown> = { ...input };
  for (const key of Object.keys(def.parameters.properties)) if (!(key in out)) out[key] = null;
  return out;
}
