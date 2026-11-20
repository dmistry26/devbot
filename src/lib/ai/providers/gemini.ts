import "server-only";
import { ApiError, GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import { ProviderError, type Provider } from "../provider";
import type { ToolDef } from "../tools";

// The free tier gets congested: newer models often time out or return
// "high demand". Try models in order, give each a short timeout with no
// SDK retries, and start with whichever model worked last time.
// GEMINI_MODEL (optional) is tried first.
const MODELS = [
  ...new Set([process.env.GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"].filter((m): m is string => !!m)),
];
const ATTEMPT_TIMEOUT_MS = 15_000;
let lastGood: string | null = null;

/**
 * Gemini handles "optional" better than "nullable": turn `type: [X, "null"]`,
 * nullable enums and `anyOf [..., null]` into plain optional fields. Missing
 * fields are filled back in with null by `normalizeInput`.
 */
function toOptional(schema: Record<string, unknown>): Record<string, unknown> {
  const s = { ...schema };
  if (Array.isArray(s.type)) {
    const types = (s.type as string[]).filter((t) => t !== "null");
    s.type = types.length === 1 ? types[0] : types;
  }
  if (Array.isArray(s.enum)) s.enum = (s.enum as unknown[]).filter((v) => v !== null);
  if (Array.isArray(s.anyOf)) {
    const rest = (s.anyOf as Record<string, unknown>[]).filter((x) => x.type !== "null");
    if (rest.length === 1) {
      delete s.anyOf;
      Object.assign(s, toOptional(rest[0]));
    }
  }
  if (s.type === "object" && s.properties) {
    const props = s.properties as Record<string, Record<string, unknown>>;
    const required = new Set((s.required as string[]) ?? []);
    const newProps: Record<string, unknown> = {};
    const newRequired: string[] = [];
    for (const [k, v] of Object.entries(props)) {
      const nullable =
        (Array.isArray(v.type) && (v.type as string[]).includes("null")) ||
        (Array.isArray(v.anyOf) && (v.anyOf as Record<string, unknown>[]).some((x) => x.type === "null"));
      newProps[k] = toOptional(v);
      if (required.has(k) && !nullable) newRequired.push(k);
    }
    s.properties = newProps;
    s.required = newRequired;
    delete s.additionalProperties;
  }
  return s;
}

const declarations = (tools: ToolDef[]): FunctionDeclaration[] =>
  tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: toOptional(t.parameters) }));

export const gemini: Provider = {
  id: "gemini",
  label: "Google Gemini",
  async run({ system, messages, tools }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ProviderError(
        "The AI isn't connected yet. Add GEMINI_API_KEY to .env.local (free from aistudio.google.com) and restart devbot.",
        "no_key",
      );
    }
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: ATTEMPT_TIMEOUT_MS, retryOptions: { attempts: 1 } } });
    const contents: Content[] = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const order = lastGood ? [lastGood, ...MODELS.filter((m) => m !== lastGood)] : MODELS;
    let busy = false;

    for (const model of order) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents,
          config: { systemInstruction: system, tools: [{ functionDeclarations: declarations(tools) }] },
        });
        if (res.promptFeedback?.blockReason) throw new ProviderError("Gemini declined that request.", "refused");
        lastGood = model;
        console.info(`Gemini answered with ${model}`);
        return {
          text: (res.text ?? "").trim(),
          calls: (res.functionCalls ?? [])
            .filter((c) => c.name)
            .map((c) => ({ name: c.name!, input: (c.args ?? {}) as Record<string, unknown> })),
        };
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        if (e instanceof ApiError) {
          if ((e.status === 400 && /api key/i.test(e.message)) || e.status === 401 || e.status === 403) {
            throw new ProviderError("Your Gemini API key was rejected. Check GEMINI_API_KEY.", "bad_key");
          }
          if (e.status === 400) {
            console.error("Gemini rejected the request", model, e.message);
            throw new ProviderError("The AI couldn't process that request.", "failed");
          }
          // 404 (model retired), 429 (quota), 5xx (overloaded): try the next model.
          console.warn(`Gemini ${model} unavailable (${e.status}); trying next model`);
          if (e.status === 429 || e.status >= 500) busy = true;
          if (lastGood === model) lastGood = null;
          continue;
        }
        // Timeouts and network errors: try the next model.
        console.warn(`Gemini ${model} timed out or failed; trying next model`);
        busy = true;
        if (lastGood === model) lastGood = null;
      }
    }
    throw new ProviderError(
      busy
        ? "Google's free AI is overloaded right now. Try again in a minute."
        : "No Gemini model is available for your key. Set GEMINI_MODEL in .env.local.",
      busy ? "rate_limited" : "failed",
    );
  },
};
