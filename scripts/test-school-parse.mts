import { parseDatePair, htmlToText, extractHomework, splitItem, resolveItem, shortCourseName, schoolYearStartFrom } from "../src/lib/school/parse.ts";
import assert from "node:assert/strict";
const Y = 2026;
assert.deepEqual(parseDatePair("November 19/20", Y), ["2026-11-19","2026-11-20"]);
assert.deepEqual(parseDatePair("**October 23/26**", Y), ["2026-10-23","2026-10-26"]);
assert.deepEqual(parseDatePair("Oct 30/Nov 2", Y), ["2026-10-30","2026-11-02"]);
assert.deepEqual(parseDatePair("January 29/2", Y), ["2027-01-29","2027-02-02"]);
assert.deepEqual(parseDatePair("Sept 3", Y), ["2026-09-03"]);
assert.equal(schoolYearStartFrom("Quarter 2 (2026-27) Book", "2026-11-19"), 2026);
assert.equal(shortCourseName("AP Calculus BC - Mr. Nie"), "AP Calculus BC");
assert.equal(shortCourseName("AP US History - Dr. Olson"), "AP US History");

const html = `<h3>October 12/14</h3><p>Unit 4</p><p><strong>Objective:</strong> stuff</p><p><strong>Classroom Activities:</strong></p><ul><li>Devotion</li><li>Lecture 4.5</li></ul><p><strong>Homework:</strong></p><ul><li>WebAssign HW 4.5</li><li>Study for group quiz next class, test next next class</li></ul>`;
const hw = extractHomework(htmlToText(html));
assert.deepEqual(hw, ["WebAssign HW 4.5", "Study for group quiz next class, test next next class"]);
assert.deepEqual(splitItem(hw[1]), ["Study for group quiz next class", "test next next class"]);

const apush = `Homework\nComplete...\nWatch Adams admin Educreations video, take notes (should not actually need to state that), Oct 15/20`;
const ah = extractHomework(apush);
assert.deepEqual(ah, ["Watch Adams admin Educreations video, take notes (should not actually need to state that), Oct 15/20"]);

const chapters = [
  { id: "1", title: "October 12/14", dates: ["2026-10-12","2026-10-14"] },
  { id: "2", title: "October 15/20", dates: ["2026-10-15","2026-10-20"] },
  { id: "3", title: "October 21/22", dates: ["2026-10-21","2026-10-22"] },
];
let r = resolveItem("WebAssign HW 4.5", 0, chapters, 1, Y);
assert.deepEqual(r, { title: "WebAssign HW 4.5", dueDate: "2026-10-20", kind: "task", priority: "normal" });
r = resolveItem("Study for group quiz next class", 0, chapters, 0, Y);
assert.deepEqual(r, { title: "Study for group quiz", dueDate: "2026-10-15", kind: "deadline", priority: "high" });
r = resolveItem("test next next class", 0, chapters, 0, Y);
assert.deepEqual(r, { title: "Test", dueDate: "2026-10-21", kind: "deadline", priority: "high" });
r = resolveItem(ah[0], 0, chapters, 1, Y);
assert.deepEqual(r, { title: "Watch Adams admin Educreations video, take notes", dueDate: "2026-10-20", kind: "task", priority: "normal" });
r = resolveItem("Read ch 5", 2, chapters, 0, Y);
assert.equal(r.dueDate, null);
console.log("all parse tests passed");

// ── merge ──
import { mergeSchoolItems, schoolTitle } from "../src/lib/school/merge.ts";
const item = (n: number, extra = {}) => ({ externalId: `vcs:1:2:${n}`, courseId: 1, courseName: "AP Calculus BC", title: "WebAssign HW 4.5", dueDate: "2026-11-21", assignedDate: "2026-11-19", kind: "task" as const, priority: "normal" as const, sourceUrl: "x", ...extra });
assert.equal(schoolTitle(item(0, { title: "Test" })), "AP Calculus BC test");
let m = mergeSchoolItems([], [item(0), item(1, { title: "Test", kind: "deadline", priority: "high" })], new Set(), "2026-11-19T22:00", "2026-11-19");
assert.equal(m.added, 2);
assert.equal(m.tasks[0].scheduledDate, "2026-11-20"); // day before due
assert.equal(m.tasks[1].scheduledDate, null); // tests stay on the horizon
// re-sync: no duplicates, due date change applied to untouched task
let m2 = mergeSchoolItems(m.tasks, [item(0, { dueDate: "2026-11-24" }), item(1, { title: "Test", kind: "deadline", priority: "high" })], new Set(), "2026-11-20T08:00", "2026-11-20");
assert.equal(m2.added, 0); assert.equal(m2.updated, 1); assert.equal(m2.tasks.length, 2);
assert.equal(m2.tasks[0].dueDate, "2026-11-24");
// dismissed items aren't re-added; done items aren't touched
const done = { ...m.tasks[0], status: "done" as const };
let m3 = mergeSchoolItems([done], [item(0, { dueDate: "2026-12-01" }), item(1)], new Set(["vcs:1:2:1"]), "2026-11-20T08:00", "2026-11-20");
assert.equal(m3.added, 0); assert.equal(m3.updated, 0);
console.log("all merge tests passed");
