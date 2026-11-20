import { parseDatePair, htmlToText, extractHomework, splitItem, parseLine, shortCourseName, schoolYearStartFrom } from "../src/lib/school/parse.ts";
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
const ctx = (i: number, day: 0 | 1 = 0) => ({ chapterIndex: i, chapters, day, schoolYearStart: Y });
const one = (line: string, i = 0, day: 0 | 1 = 0) => parseLine(line, ctx(i, day)).map(({ key, ...r }) => r);

assert.deepEqual(one("WebAssign HW 4.5", 0, 1), [{ title: "WebAssign HW 4.5", dueDate: "2026-10-20", dueTime: null, kind: "task", priority: "normal" }]);
assert.deepEqual(one("test next next class"), [{ title: "Test", dueDate: "2026-10-21", dueTime: null, kind: "deadline", priority: "high" }]);
// prep + deadline
let r = one("Study for group quiz next class");
assert.equal(r.length, 2);
assert.deepEqual(r[0], { title: "Study for group quiz", dueDate: "2026-10-15", dueTime: null, kind: "task", priority: "high" });
assert.equal(r[1].title, "Group quiz"); assert.equal(r[1].kind, "deadline");
// real APUSH lines
r = one("Study for test which is Nov 19/20", 0, 1);
assert.equal(r[0].title, "Study for test"); assert.equal(r[0].dueDate, "2026-11-20");
assert.equal(r[1].title, "Test"); assert.equal(r[1].dueDate, "2026-11-20");
r = one("Work on study guide for test!! Test is Nov 19/20");
assert.equal(r[0].title, "Work on study guide for test"); assert.equal(r[0].dueDate, "2026-11-19");
r = one("Watch Adams admin Educreations video, take notes (should not actually need to state that), Oct 15/20", 0, 1);
assert.deepEqual(r, [{ title: "Watch Adams admin Educreations video, take notes", dueDate: "2026-10-20", dueTime: null, kind: "task", priority: "normal" }]);
// real Data Structures announcements → deadline only
r = one("Reminder that our Unit 4 test will take place on Wednesday, December 3rd.");
assert.deepEqual(r, [{ title: "Unit 4 test", dueDate: "2026-12-03", dueTime: null, kind: "deadline", priority: "high" }]);
r = one("Because of the Thanksgiving break, our Unit 4 test will take place after we get back from the break. Next class, November 20th, will be the beginning of Unit 5. Our distance learning day will cover another lesson in Unit 5. After we get back from break, we will have our review and test for Unit 4 on December 1/3.");
assert.equal(r.length, 1); assert.equal(r[0].kind, "deadline"); assert.equal(r[0].dueDate, "2026-12-01"); assert.equal(r[0].title, "Unit 4 test");
assert.deepEqual(one("Complete assignments from this unit and review for the test!").map((x) => x.kind), ["task"]);
// real Stats line: time + date
r = one("Complete Achieve homework 3C due 9:15am Nov 24.");
assert.deepEqual(r, [{ title: "Complete Achieve homework 3C", dueDate: "2026-11-24", dueTime: "09:15", kind: "task", priority: "normal" }]);
// noise
assert.deepEqual(one("Population parameter defined"), []);
assert.deepEqual(one("Conclusion in Context"), []);
assert.deepEqual(one("None! I am so proud of all of your hard work"), []);
assert.deepEqual(one("NONE: Thanksgiving break"), []);
assert.deepEqual(one("Here is your research link for your project, here"), []);
// link text + weekday
r = one("Complete the What's The Problem Worksheet by Nov. 19/20, Here");
assert.equal(r[0].title, "Complete the What's The Problem Worksheet");
r = one("Finish CBMCQ online, be ready to demonstrate understanding for it in class on Friday", 2);
assert.equal(r[0].dueDate, "2026-10-23"); // Friday after Wed Oct 21
assert.equal(shortCourseName("Data Structures &amp; Algorithms - Mr. MacMillan"), "Data Structures & Algorithms");
console.log("all parse tests passed");

// ── merge ──
import { mergeSchoolItems, schoolTitle } from "../src/lib/school/merge.ts";
const item = (n: number, extra = {}) => ({ externalId: `vcs:1:2:${n}`, courseId: 1, courseName: "AP Calculus BC", title: "WebAssign HW 4.5", dueDate: "2026-11-21", dueTime: null, assignedDate: "2026-11-19", kind: "task" as const, priority: "normal" as const, sourceUrl: "x", ...extra });
assert.equal(schoolTitle(item(0, { title: "Test" })), "AP Calculus BC test");
assert.equal(schoolTitle(item(0, { title: "Unit 4 test" })), "AP Calculus BC unit 4 test");
assert.equal(schoolTitle(item(0)), "WebAssign HW 4.5");
let m = mergeSchoolItems([], [item(0), item(1, { title: "Test", kind: "deadline", priority: "high" })], new Set(), "2026-11-19T22:00", "2026-11-19");
assert.equal(m.added, 2);
assert.equal(m.tasks[0].scheduledDate, "2026-11-20"); // day before due
assert.equal(m.tasks[1].scheduledDate, null); // tests stay on the horizon
// re-sync: no duplicates, due date change applied to untouched task
let m2 = mergeSchoolItems(m.tasks, [item(0, { dueDate: "2026-11-24" }), item(1, { title: "Test", kind: "deadline", priority: "high" })], new Set(), "2026-11-20T08:00", "2026-11-20");
assert.equal(m2.added, 0); assert.equal(m2.updated, 1); assert.equal(m2.tasks.length, 2);
assert.equal(m2.tasks[0].dueDate, "2026-11-24");
assert.equal(m.tasks[0].context, "AP Calculus BC");
const noCtx = { ...m.tasks[0], context: undefined };
assert.equal(mergeSchoolItems([noCtx], [item(0)], new Set(), "x", "2026-11-19").tasks[0].context, "AP Calculus BC");
// dismissed items aren't re-added; done items aren't touched
const done = { ...m.tasks[0], status: "done" as const };
let m3 = mergeSchoolItems([done], [item(0, { dueDate: "2026-12-01" }), item(1)], new Set(["vcs:1:2:1"]), "2026-11-20T08:00", "2026-11-20");
assert.equal(m3.added, 0); assert.equal(m3.updated, 0);
console.log("all merge tests passed");
