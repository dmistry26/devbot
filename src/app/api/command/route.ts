import Anthropic from "@anthropic-ai/sdk";
import { TOOLS } from "@/lib/ai/tools";
import { SYSTEM, buildContext, type AgentId } from "@/lib/ai/prompt";
import type { Snapshot } from "@/lib/types";
import type { Action } from "@/lib/actions";

// The AI model is configured in one place so it's easy to swap later.
const MODEL = process.env.DEVBOT_MODEL ?? "claude-opus-5-5";

interface Body {
  messages: { role: "user" | "assistant"; content: string }[];
  snapshot: Snapshot;
  now: string; // local YYYY-MM-DDTHH:mm from the browser
  agent: AgentId;
}

export interface CommandResponse {
  reply: string;
  actions: Action[];
  agent: AgentId;
  error?: "no_key" | "refused" | "rate_limited" | "failed";
}

const json = (body: CommandResponse, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ reply: "Bad request.", actions: [], agent: "chief", error: "failed" }, 400);
  }
  const agent: AgentId = body.agent === "academic" ? "academic" : "chief";
  const history = (body.messages ?? []).filter((m) => typeof m.content === "string" && m.content.trim()).slice(-16);
  if (!history.length || history[history.length - 1].role !== "user" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.now ?? "")) {
    return json({ reply: "Bad request.", actions: [], agent, error: "failed" }, 400);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(
      {
        reply: "The AI isn't connected yet. Add ANTHROPIC_API_KEY to .env.local and restart the dev server.",
        actions: [],
        agent,
        error: "no_key",
      },
      503,
    );
  }

  // Volatile context goes in the last user turn so the system prompt + tools stay cacheable.
  const context = buildContext(body.snapshot, body.now);
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = history.map((m, i) =>
    i === history.length - 1
      ? { role: "user", content: `<context>\n${context}\n</context>\n\n${m.content}` }
      : { role: m.role, content: m.content },
  );

  const client = new Anthropic();
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: SYSTEM[agent], cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      tool_choice: { type: "auto" },
      messages,
    });

    if (res.stop_reason === "refusal") {
      return json({ reply: "I can't help with that one.", actions: [], agent, error: "refused" });
    }

    const reply = res.content
      .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const actions: Action[] = res.content
      .filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use")
      .map((b) => ({ type: b.name, ...(b.input as object) }) as Action);

    return json({
      reply: reply || (actions.length ? "Here's what I'd change:" : "Done."),
      actions,
      agent,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return json({ reply: "Your Anthropic API key was rejected. Check ANTHROPIC_API_KEY.", actions: [], agent, error: "no_key" }, 401);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return json({ reply: "Rate limited — try again in a moment.", actions: [], agent, error: "rate_limited" }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return json({ reply: `The AI request failed (${err.status ?? "network"}).`, actions: [], agent, error: "failed" }, 502);
    }
    console.error(err);
    return json({ reply: "Something went wrong talking to the AI.", actions: [], agent, error: "failed" }, 500);
  }
}
