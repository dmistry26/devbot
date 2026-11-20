import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type Provider } from "../provider";

const MODEL = process.env.DEVBOT_MODEL ?? "claude-opus-5-5";
// Server-side refusal fallback is supported on these models only.
const SUPPORTS_FALLBACK = /^claude-(opus-5-5|opus-5|sonnet-5-5|fable-5)/.test(MODEL);

export const anthropic: Provider = {
  id: "anthropic",
  label: `Claude ${MODEL}`,
  async run({ system, messages, tools }) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ProviderError("The AI isn't connected yet. Add ANTHROPIC_API_KEY to .env.local and restart devbot.", "no_key");
    }
    const client = new Anthropic();
    try {
      const res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        ...(SUPPORTS_FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        output_config: { effort: "medium" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: tools.map((t) => ({ name: t.name, description: t.description, strict: true, input_schema: t.parameters })),
        tool_choice: { type: "auto" },
        messages,
      });
      if (res.stop_reason === "refusal") throw new ProviderError("I can't help with that one.", "refused");
      return {
        text: res.content
          .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim(),
        calls: res.content
          .filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use")
          .map((b) => ({ name: b.name, input: b.input as Record<string, unknown> })),
      };
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
