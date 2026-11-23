import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { MAX_SERVER_ROUNDS, ProviderError, type Provider } from "../provider";

const MODEL = process.env.DEVBOT_MODEL ?? "claude-opus-5-5";
// Server-side refusal fallback is supported on these models only.
const SUPPORTS_FALLBACK = /^claude-(opus-5-5|opus-5|sonnet-5-5|fable-5)/.test(MODEL);

export const anthropic: Provider = {
  id: "anthropic",
  label: `Claude ${MODEL}`,
  async run({ system, messages, tools, serverTools }) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ProviderError("The AI isn't connected yet. Add ANTHROPIC_API_KEY to .env.local and restart devbot.", "no_key");
    }
    const client = new Anthropic();
    const convo: Anthropic.Beta.Messages.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
    const proposals: { name: string; input: Record<string, unknown> }[] = [];
    try {
      for (let round = 0; ; round++) {
        const res = await client.beta.messages.create({
          model: MODEL,
          max_tokens: 16000,
          ...(SUPPORTS_FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
          output_config: { effort: "medium" },
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          tools: tools.map((t) => ({ name: t.name, description: t.description, strict: true, input_schema: t.parameters })),
          tool_choice: { type: "auto" },
          messages: convo,
        });
        if (res.stop_reason === "refusal") throw new ProviderError("I can't help with that one.", "refused");
        const uses = res.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
        const serverUses = uses.filter((b) => serverTools?.[b.name]);
        for (const b of uses) if (!serverTools?.[b.name]) proposals.push({ name: b.name, input: b.input as Record<string, unknown> });
        if (!serverUses.length || round >= MAX_SERVER_ROUNDS) {
          return {
            text: res.content
              .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
              .map((b) => b.text)
              .join("\n")
              .trim(),
            calls: proposals,
          };
        }
        // Append the assistant turn unchanged, then a result for every tool call in it.
        convo.push({ role: "assistant", content: res.content });
        const results = await Promise.all(
          uses.map(async (b): Promise<Anthropic.Beta.Messages.BetaToolResultBlockParam> => {
            if (!serverTools?.[b.name]) return { type: "tool_result", tool_use_id: b.id, content: "Shown to the user as a proposal to confirm." };
            try {
              const out = await serverTools[b.name](b.input as Record<string, unknown>);
              return { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out) };
            } catch (e) {
              return { type: "tool_result", tool_use_id: b.id, content: e instanceof Error ? e.message : "The search failed.", is_error: true };
            }
          }),
        );
        convo.push({ role: "user", content: results });
      }
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof Anthropic.AuthenticationError) throw new ProviderError("Your Anthropic API key was rejected.", "bad_key");
      if (err instanceof Anthropic.RateLimitError) throw new ProviderError("Rate limited — try again in a moment.", "rate_limited");
      if (err instanceof Anthropic.APIError) {
        console.error("Anthropic API error", err.status, err.message);
        throw new ProviderError(`The AI request failed (${err.status ?? "network"}).`, "failed");
      }
      console.error(err);
      throw new ProviderError("Something went wrong talking to the AI.", "failed");
    }
  },
};
