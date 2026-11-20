import "server-only";
import { ApiError, GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import { ProviderError, type Provider } from "../provider";
import type { ToolDef } from "../tools";

// Free-tier friendly default; override with GEMINI_MODEL.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

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
  label: `Google ${MODEL}`,
  async run({ system, messages, tools }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ProviderError(
        "The AI isn't connected yet. Add GEMINI_API_KEY to .env.local (free from aistudio.google.com) and restart devbot.",
        "no_key",
      );
    }
    const ai = new GoogleGenAI({ apiKey });
    const contents: Content[] = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: system,
          tools: [{ functionDeclarations: declarations(tools) }],
        },
      });
      if (res.promptFeedback?.blockReason) {
        throw new ProviderError("Gemini declined that request.", "refused");
      }
      return {
        text: (res.text ?? "").trim(),
        calls: (res.functionCalls ?? [])
          .filter((c) => c.name)
          .map((c) => ({ name: c.name!, input: (c.args ?? {}) as Record<string, unknown> })),
      };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      if (e instanceof ApiError) {
        if (e.status === 429) throw new ProviderError("Gemini's free-tier limit was hit — wait a minute and try again.", "rate_limited");
        if (e.status === 400 && /api key/i.test(e.message)) throw new ProviderError("Your Gemini API key was rejected. Check GEMINI_API_KEY.", "bad_key");
        if (e.status === 401 || e.status === 403) throw new ProviderError("Your Gemini API key was rejected. Check GEMINI_API_KEY.", "bad_key");
        if (e.status === 404) throw new ProviderError(`Gemini model "${MODEL}" isn't available. Set GEMINI_MODEL in .env.local.`, "failed");
        console.error("Gemini API error", e.status, e.message);
        throw new ProviderError(`The AI request failed (${e.status}).`, "failed");
      }
      console.error(e);
      throw new ProviderError("Couldn't reach Gemini.", "failed");
    }
  },
};
