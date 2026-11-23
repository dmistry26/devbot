// Tool schemas the model uses to PROPOSE changes. Nothing is executed on the
// server: tool calls come back to the browser as proposals the user confirms.
// Provider-neutral JSON Schema; every field is required (nullable when
// optional). Each provider adapter converts these to its own format.

const CATEGORY = ["academic", "project", "personal", "health", "social", "other"];
const PRIORITY = ["urgent", "high", "normal", "low"];

const s = (description: string) => ({ type: "string", description });
const ns = (description: string) => ({ type: ["string", "null"], description });
const nenum = (values: string[], description: string) => ({
  type: ["string", "null"],
  enum: [...values, null],
  description,
});

export interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, Record<string, unknown>>;
    required: string[];
    additionalProperties: false;
  };
}

function tool(name: string, description: string, properties: Record<string, Record<string, unknown>>): ToolDef {
  return {
    name,
    description,
    parameters: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
  };
}

const DATE = "YYYY-MM-DD, or null";
const TIME = "HH:mm 24h, or null";
const DT = "Local datetime YYYY-MM-DDTHH:mm";

export const TOOLS: ToolDef[] = [
  tool("create_task", "Propose a new task or deadline. Use kind='deadline' for tests, quizzes, due dates and applications; 'task' for things to do.", {
    title: s("Short, specific title, e.g. 'Review APUSH unit 5 notes'"),
    description: ns("Optional detail"),
    priority: { type: "string", enum: PRIORITY },
    kind: { type: "string", enum: ["task", "deadline"] },
    category: { type: "string", enum: CATEGORY },
    due_date: ns(`When it is due. ${DATE}`),
    due_time: ns(`Due time. ${TIME}`),
    scheduled_date: ns(`The day the user should work on it. ${DATE}`),
    project_name: ns("Name of an existing or just-proposed project, or null"),
  }),
  tool("update_task", "Propose changes to an existing task. Use null for fields that should stay the same.", {
    task_id: s("Exact id from the context"),
    title: ns("New title or null"),
    priority: nenum(PRIORITY, "New priority or null"),
    due_date: ns(`New due date. ${DATE}`),
    due_time: ns(`New due time. ${TIME}`),
    scheduled_date: ns(`New work-on day. ${DATE}`),
    category: nenum(CATEGORY, "New category or null"),
  }),
  tool("complete_task", "Mark an existing task done — only when the user says they finished it.", {
    task_id: s("Exact id from the context"),
  }),
  tool("delete_task", "Delete a task. Only when the user clearly asks to remove/cancel it.", {
    task_id: s("Exact id from the context"),
  }),
  tool("create_event", "Propose a calendar event, or a focus block for a task (set task_id). Check the schedule for conflicts first.", {
    title: s("Event title"),
    start: s(DT),
    end: s(DT),
    location: ns("Location or null"),
    category: { type: "string", enum: CATEGORY },
    recurrence: {
      anyOf: [
        {
          type: "object",
          properties: {
            freq: { type: "string", enum: ["daily", "weekdays", "weekly", "monthly"] },
            until: ns(`Last date it repeats, inclusive. ${DATE}`),
          },
          required: ["freq", "until"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
      description: "Repeat rule or null for one-off",
    },
    task_id: ns("If this is a work block for an existing task, its exact id; else null"),
  }),
  tool("update_event", "Move or rename an existing event. Use null for fields that stay the same.", {
    event_id: s("Exact id from the context"),
    title: ns("New title or null"),
    start: ns(`${DT}, or null`),
    end: ns(`${DT}, or null`),
    location: ns("New location or null"),
  }),
  tool("delete_event", "Remove an event. Only when the user clearly asks.", {
    event_id: s("Exact id from the context"),
  }),
  tool("create_project", "Propose a new project to group related tasks.", {
    name: s("Project name"),
    description: ns("One-line description or null"),
    target_date: ns(`Target completion date. ${DATE}`),
  }),
  tool("create_note", "Save a note or idea.", {
    title: s("Short title"),
    content: s("The note body"),
    category: { type: "string", enum: CATEGORY },
    project_name: ns("Related project name or null"),
  }),
];

/** Read-only tools the server executes during an answer (never shown as proposals). */
export const SERVER_TOOLS: ToolDef[] = [
  tool(
    "search_lesson_plans",
    "Search the student's learn.vcs.net lesson plans (all class days from 3 days ago to 2 months ahead) for tests, quizzes, homework or any topic. Use it when they ask about something at school (\"do I have a math test?\", \"when is the Spanish quiz?\", \"what are we doing in APUSH next week?\") and the answer isn't already in the context. Returns detected tests with dates plus matching lesson-plan lines.",
    {
      class_name: ns("Class or subject to search, e.g. \"AP Calculus BC\", \"math\", \"physics\". null searches every class."),
      query: ns("Extra words to look for besides tests/quizzes, e.g. \"essay\", \"project\", \"chapter 6\". null for tests and quizzes only."),
    },
  ),
];
