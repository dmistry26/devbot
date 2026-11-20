import { parseDatePair, htmlToText, extractHomework, splitItem, parseLine, shortCourseName, schoolYearStartFrom, extractAssessments, assessmentTitle } from "../src/lib/school/parse.ts";
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
const one = (line: string, i = 0, day: 0 | 1 = 0) => parseLine(line, ctx(i, day)).map(({ key, rank, ...r }) => r);

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
// ── tests found anywhere in the lesson plan (real VCS lines) ──
assert.equal(assessmentTitle("Study for Momentum Quiz next class", "quiz"), "Momentum Quiz");
assert.equal(assessmentTitle("Thursday - Circular Motion and Linear Momentum Test", "test"), "Circular Motion and Linear Momentum Test");
assert.equal(assessmentTitle("Free Response 3A quiz (12 min)", "quiz"), "Free Response 3A quiz");
assert.equal(assessmentTitle("Reminder that our Unit 4 test will take place", "test"), "Unit 4 test");
assert.equal(assessmentTitle("Study for test which is Nov 19/20", "test"), "Test");
const wk = [
  { id: "a", title: "November 16", dates: ["2026-11-16"] },
  { id: "b", title: "November 18", dates: ["2026-11-18"] },
  { id: "c", title: "November 20", dates: ["2026-11-20"] },
];
const ax = (text: string, i: number) => extractAssessments(text, { chapterIndex: i, chapters: wk, day: 0, schoolYearStart: 2026 }).map((x) => `${x.dueDate} ${x.title} r${x.rank}`);
// Physics weekly plan inside the Nov 18 chapter: Monday quiz this week, Thursday test rolls into next week
const physics = "Classroom Activities\n- Turn in 5 FRQs\nMonday: Momentum Quiz, HW: FRQ5\nWednesday: Turn in all FRQs, HW: CBMCQ\nFriday: Study day (CB MCQ in class)\nThursday - Circular Motion and Linear Momentum Test\nHomework\n- Do FRQ 5";
assert.deepEqual(ax(physics, 1), ["2026-11-16 Momentum Quiz r2", "2026-11-26 Circular Motion and Linear Momentum Test r2"]);
// Real Nov 20 Physics plan: rolls through Zoom Tuesday (Nov 24) and the Tuesday after break (Dec 1) to Thursday Dec 3
const physicsNov20 = "Classroom Activities\n- Pick up FRQs for Tuesday's Zoom class\nMonday: Momentum Quiz, HW: FRQ5\nWednesday: Turn in all FRQs, HW: CBMCQ\nFriday: Study day (CB MCQ in class)\nTuesday (On Zoom) - FRQs in class, due during class\nTuesday - Study day\nThursday - Circular Motion and Linear Momentum Test\nHomework\n- Have a great weekend";
assert.deepEqual(ax(physicsNov20, 2), ["2026-11-16 Momentum Quiz r2", "2026-12-03 Circular Motion and Linear Momentum Test r2"]);
// Activity lines that are the test that day
assert.deepEqual(ax("Unit 5: Test\nClassroom Activities\n- Devotion\n- Chapter 5 Test\nHomework\n- None", 0), ["2026-11-16 Unit 5 Test r3", "2026-11-16 Chapter 5 Test r3"]);
assert.deepEqual(ax("Classroom Activities\n- Free Response 3A quiz (12 min)\n- Momentum Quiz next class", 0), ["2026-11-16 Free Response 3A quiz r3", "2026-11-18 Momentum Quiz r1"]);
// Things that are NOT tests happening
const noise = [
  "Students will be able to state appropriate hypotheses for a test for a population proportion.",
  "· Calculate the standardized test statistic and P-value for a test about a population proportion.",
  "Make an appropriate conclusion for a hypothesis test.",
  "- Unit 2 Exam feedback conferences. You can also conference at lunch and after school!",
  "- Exam Unit 2 Feedback on Free Response conferences.",
  "- Review activities for test",
  "- Achieve 3A Exercise #15 video to review for quiz. (5 minutes)",
  "- Students will be prepared for the Unit 5 Test during finals week",
];
for (const n of noise) assert.deepEqual(ax("Classroom Activities\n" + n, 0), [], n);
// Homework section is left to parseLine
assert.deepEqual(ax("Activities\n- Lecture\nHomework\n- Unit 4 Test", 0), []);
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
// Old-format test id is recognized as the same test (no duplicate), and adopts the new id
const oldTest = { ...m.tasks[1], externalId: "vcs:1:deadline:unit-4-test:20261130", title: "AP Calculus BC unit 4 test", dueDate: "2026-12-01", context: "AP Calculus BC", source: "school" as const };
const newItem = item(9, { externalId: "vcs:1:deadline:test:20261130", title: "Unit 4 Test", kind: "deadline", priority: "high", dueDate: "2026-12-03" });
const m4 = mergeSchoolItems([oldTest], [newItem], new Set(), "2026-11-21T08:00", "2026-11-21");
assert.equal(m4.added, 0); assert.equal(m4.tasks.length, 1);
assert.equal(m4.tasks[0].dueDate, "2026-12-03"); assert.equal(m4.tasks[0].externalId, "vcs:1:deadline:test:20261130");
// A test deleted under its old id stays deleted
const m5 = mergeSchoolItems([], [newItem], new Set(["vcs:1:deadline:unit-4-test:20261130"]), "x", "2026-11-21");
assert.equal(m5.added, 0);
// Different type same week is a different test
const quiz = item(10, { externalId: "vcs:1:deadline:quiz:20261130", title: "Group quiz", kind: "deadline", priority: "high", dueDate: "2026-12-01" });
assert.equal(mergeSchoolItems([oldTest], [quiz], new Set(), "x", "2026-11-21").added, 1);
// A test that moved a week (parser fix) updates in place
const physOld = { ...m.tasks[1], externalId: "vcs:1340:deadline:test:20261123", title: "Circular Motion and Linear Momentum Test", dueDate: "2026-11-26", context: "AP Physics 1", source: "school" as const };
const physNew = item(11, { externalId: "vcs:1340:deadline:test:20261130", courseName: "AP Physics 1", title: "Circular Motion and Linear Momentum Test", kind: "deadline", priority: "high", dueDate: "2026-12-03" });
const m6 = mergeSchoolItems([physOld], [physNew], new Set(), "x", "2026-11-21");
assert.equal(m6.tasks.length, 1); assert.equal(m6.tasks[0].dueDate, "2026-12-03");
console.log("all merge tests passed");
