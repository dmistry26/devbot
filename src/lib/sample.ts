// Optional, clearly-labelled sample data so you can see the interface before
// adding your own. Everything here has source "sample" and can be cleared in one click.

import type { Snapshot, Task, CalendarEvent, Project } from "./types";
import { addDays, toDateKey } from "./dates";

export function buildSample(now: Date): Snapshot {
  const d = (n: number) => toDateKey(addDays(now, n));
  const ts = `${d(0)}T08:00`;
  const id = (p: string, n: number) => `sample-${p}-${n}`;

  const projects: Project[] = [
    {
      id: id("p", 1),
      name: "Robotics",
      description: "Competition robot — drivetrain and autonomous routine.",
      status: "active",
      startDate: d(-20),
      targetDate: d(18),
      notes: null,
      source: "sample",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: id("p", 2),
      name: "Science Fair",
      description: "Research project on soil microbiomes.",
      status: "active",
      startDate: d(-5),
      targetDate: d(40),
      notes: null,
      source: "sample",
      createdAt: ts,
      updatedAt: ts,
    },
  ];

  const task = (n: number, t: Partial<Task> & Pick<Task, "title">): Task => ({
    id: id("t", n),
    description: null,
    status: "todo",
    priority: "normal",
    kind: "task",
    category: "academic",
    dueDate: null,
    dueTime: null,
    scheduledDate: d(0),
    projectId: null,
    source: "sample",
    createdAt: ts,
    updatedAt: ts,
    completedAt: null,
    ...t,
  });

  const tasks: Task[] = [
    task(1, { title: "APUSH unit 5 test", kind: "deadline", priority: "urgent", dueDate: d(3), scheduledDate: null }),
    task(2, { title: "Chemistry lab report", priority: "high", dueDate: d(1), dueTime: "08:00" }),
    task(3, { title: "Calc problem set 4.2", priority: "high", dueDate: d(0), dueTime: "23:59" }),
    task(4, { title: "Wire the drivetrain encoders", category: "project", projectId: id("p", 1), priority: "normal" }),
    task(5, { title: "Read English ch. 7–8", priority: "normal", dueDate: d(2), scheduledDate: d(0) }),
    task(6, { title: "Email coach about Saturday", category: "personal", priority: "low" }),
    task(7, { title: "Tune autonomous path", category: "project", projectId: id("p", 1), scheduledDate: d(2) }),
    task(8, { title: "SAT practice test", kind: "deadline", priority: "high", dueDate: d(6), scheduledDate: null }),
    task(9, { title: "Science fair proposal", kind: "deadline", priority: "high", category: "project", projectId: id("p", 2), dueDate: d(8), scheduledDate: null }),
    task(10, { title: "Spanish vocab quiz", kind: "deadline", priority: "normal", dueDate: d(1), scheduledDate: null }),
  ];

  const ev = (n: number, title: string, day: number, s: string, e: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
    id: id("e", n),
    title,
    description: null,
    start: `${d(day)}T${s}`,
    end: `${d(day)}T${e}`,
    location: null,
    category: "academic",
    recurrence: null,
    taskId: null,
    source: "sample",
    createdAt: ts,
    updatedAt: ts,
    ...extra,
  });

  const events: CalendarEvent[] = [
    ev(1, "School", 0, "08:00", "15:10", { recurrence: { freq: "weekdays", until: null }, category: "academic" }),
    ev(2, "Robotics build", 0, "15:30", "17:30", { category: "project", location: "Lab 204" }),
    ev(3, "Dinner", 0, "18:30", "19:15", { category: "personal", recurrence: { freq: "daily", until: null } }),
    ev(4, "Tutoring", 1, "16:00", "17:00", { category: "academic" }),
    ev(5, "Robotics meeting", 1, "17:00", "19:00", { category: "project" }),
    ev(6, "Orthodontist", 1, "19:30", "20:15", { category: "health" }),
  ];

  return { tasks, events, projects, notes: [] };
}

export const isSample = (s: { source: string }) => s.source === "sample";
