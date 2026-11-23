import assert from "node:assert/strict";
import { unitChapters, unitChapterItems } from "../src/lib/school/units.ts";
// Real structure of AP Calculus BC's "Ch. 6" tab (Nov 2026)
const sections = [
  { id: 1, name: "Lesson Plans &amp; Homework", section: 2, modules: [] },
  { id: 2, name: "Ch. 6", section: 8, modules: [
    { id: 10, modname: "label", name: "November 17", description: "<p>November 17</p>" },
    { id: 11, modname: "resource", name: "Lecture 6.1-3 Slides (Shak)" },
    { id: 12, modname: "resource", name: "Warmup 6.1-2" },
    { id: 13, modname: "label", name: "Homework: WebAssign 6.1 November 19", description: "<p>Homework: WebAssign 6.1</p><h4>November 19</h4>" },
    { id: 14, modname: "resource", name: "AP MCQ Practice" },
    { id: 15, modname: "resource", name: "Chapter 6 Take Home Quiz" },
    { id: 16, modname: "url", name: "Optional Riemann Integration Project (50pts mastery, due 12/14 by email)" },
    { id: 17, modname: "label", name: "Homework: Study! November 30", description: "<p>Homework: Study!</p><h4>November 30</h4>" },
    { id: 18, modname: "label", name: "Homework: Make sure all Chapter 6 assignments are submitted December 2", description: "<p>Homework: Make sure all Chapter 6 assignments are submitted</p><h4>December 2</h4>" },
    { id: 19, modname: "assign", name: "Chapter 6 WebAssign Homework Journal [due 12/2]" },
    { id: 20, modname: "assign", name: "Chapter 6 Take Home Quiz [due 12/2]" },
  ] },
];
const ch = unitChapters(sections, 2026);
assert.deepEqual(ch.map((c) => c.dates[0]), ["2026-11-17", "2026-11-19", "2026-11-30", "2026-12-02"]);
assert.deepEqual(ch[0].lines, ["Homework: WebAssign 6.1"]);
const all = ch.flatMap((_, i) => unitChapterItems(ch, i, 0, 2026)).map((x) => `${x.dueDate} ${x.kind} ${x.title}`);
assert.ok(all.includes("2026-11-19 task WebAssign 6.1"), all.join("\n"));
assert.ok(all.includes("2026-12-14 task Optional Riemann Integration Project"), all.join("\n"));
assert.ok(all.includes("2026-12-02 task Chapter 6 WebAssign Homework Journal"), all.join("\n"));
assert.ok(all.includes("2026-12-02 deadline Chapter 6 Take Home Quiz"), all.join("\n"));
assert.ok(all.includes("2026-12-02 task Make sure all Chapter 6 assignments are submitted"), all.join("\n"));
assert.ok(!all.some((x) => /Lecture|Warmup|MCQ Practice/.test(x)), all.join("\n")); // plain files aren't tasks
console.log("all units tests passed");

// ── tab intro text (section summaries), real VCS wording ──
import { summaryItems } from "../src/lib/school/units.ts";
const stats = `<p>Unit 2 Exam Nov 9 - Study Guide posted by Nov. 2, Practice Tests in Achieve in Progress category. Turn in classwork binders beginning of class Nov. 9.</p>
<p><b>Unit 3 Part 1 Exam</b> Dec 7 - <b>Study Guide</b> posted by Nov 30, <b>Practice Test</b> in Achieve in Progress Category opens Nov 20 due Dec 7 at 8am. Turn in <b>classwork binders Dec 3</b> beginning of class. <i>Classwork binder must be in order of lesson dates!</i></p>`;
const si = summaryItems(stats, 2026, 0).map((x) => `${x.dueDate} ${x.dueTime ?? ""} ${x.kind} ${x.title}`.replace(/\s+/g, " "));
assert.ok(si.includes("2026-12-07 deadline Unit 3 Part 1 Exam"), si.join("\n"));
assert.ok(si.some((x) => x.startsWith("2026-12-07 08:00 task Practice Test")), si.join("\n"));
assert.ok(si.some((x) => x.startsWith("2026-12-03 task Turn in classwork binders")), si.join("\n"));
assert.ok(si.includes("2026-11-09 deadline Unit 2 Exam"), si.join("\n")); // past ones are filtered later by date
assert.ok(!si.some((x) => /Study Guide/.test(x)), si.join("\n")); // "posted by" isn't a due date
assert.ok(si.some((x) => /Practice Test in Achieve in Progress Category$/.test(x)), si.join("\n")); // no trailing "at"
assert.deepEqual(summaryItems("<p>Upon entering in 2026, students commit to 25 hours, due by May 9 2026.</p>", 2026, 0).filter((x) => !/[a-z]{3}/i.test(x.title)), []);
const calc = summaryItems("<p>Dec. 2: Ch. 6 Test</p>", 2026, 0).map((x) => `${x.dueDate} ${x.kind} ${x.title}`);
assert.deepEqual(calc, ["2026-12-02 deadline Ch 6 Test"]);
console.log("all summary tests passed");
