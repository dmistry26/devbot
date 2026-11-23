import { requireAuth } from "@/lib/auth";
import { SERVER_TOOLS, TOOLS } from "@/lib/ai/tools";
import { searchLessonPlans } from "@/lib/school/search";
import { SYSTEM, buildContext, type AgentId } from "@/lib/ai/prompt";
import { ProviderError, getProvider, normalizeInput } from "@/lib/ai/provider";
import type { GradesSnapshot, Snapshot } from "@/lib/types";
import type { Action } from "@/lib/actions";

interface Body {
  messages: { role: "user" | "assistant"; content: string }[];
  snapshot: Snapshot;
  grades?: GradesSnapshot | null;
  /** Per-class A/B pick, so lesson-plan date pairs resolve to the right day. */
  days?: Record<string, 0 | 1>;
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
const TOOL_NAMES = new Set(TOOLS.map((t) => t.name));

export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
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

  // Volatile context goes in the last user turn so the system prompt + tools stay cacheable.
  const context = buildContext(body.snapshot, body.now, body.grades);
  const messages = history.map((m, i) =>
    i === history.length - 1 ? { role: m.role, content: `<context>\n${context}\n</context>\n\n${m.content}` } : m,
  );

  try {
    const provider = await getProvider();
    const today = body.now.slice(0, 10);
    const res = await provider.run({
      system: SYSTEM[agent],
      messages,
      tools: [...TOOLS, ...SERVER_TOOLS],
      serverTools: {
        search_lesson_plans: async (input) => {
          const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null);
          try {
            return await searchLessonPlans({ className: str(input.class_name), query: str(input.query), today, days: body.days ?? {} });
          } catch (e) {
            return { error: e instanceof Error ? e.message : "Couldn't search learn.vcs.net." };
          }
        },
      },
    });
    const actions: Action[] = res.calls
      .filter((c) => TOOL_NAMES.has(c.name))
      .map((c) => ({ type: c.name, ...normalizeInput(TOOLS.find((t) => t.name === c.name), c.input) }) as Action);
    return json({
      reply: res.text || (actions.length ? "Here's what I'd add. Look it over and untick anything you don't want:" : "Done."),
      actions,
      agent,
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      const error = err.code === "bad_key" ? "no_key" : err.code;
      const status = err.code === "no_key" ? 503 : err.code === "bad_key" ? 401 : err.code === "rate_limited" ? 429 : err.code === "refused" ? 200 : 502;
      return json({ reply: err.message, actions: [], agent, error }, status);
    }
    console.error(err);
    return json({ reply: "Something went wrong talking to the AI.", actions: [], agent, error: "failed" }, 500);
  }
}
