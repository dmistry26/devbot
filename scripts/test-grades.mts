import assert from "node:assert/strict";
import { decodePayload, parsePayload, matchCourse } from "../src/lib/grades/import.ts";
const payload = { v: 1, terms: ["Q1", "Q2", "S1", "Q3"], classes: [
  { n: "AP Calculus BC", t: "Nie, Kevin", g: [["Q1", "A", "95.4"], ["Q2", "A-", 91.2], ["S1", "A", 93]] },
  { n: "AP Lang & Comp", t: "Ortiz", g: [["Q1", "B+", 88]] },
  { n: "<script>alert(1)</script>", t: null, g: [["Q1", "ZZZZZZ", 999]] },
  { n: "", g: [] },
] };
const enc = Buffer.from(JSON.stringify(payload)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
const raw = decodePayload("#grades=" + enc);
const p = parsePayload(raw)!;
assert.equal(p.classes.length, 3);
assert.deepEqual(p.classes[0].current, { term: "Q2", letter: "A-", percent: 91.2 }); // quarter preferred over semester
assert.equal(p.classes[2].grades[0].letter, "ZZZZ"); // capped
assert.equal(p.classes[2].grades[0].percent, null); // out of range dropped
assert.equal(parsePayload({ v: 2, classes: [] }), null);
assert.equal(decodePayload("#nothing"), null);
const courses = [{ id: 1769, name: "AP Calculus BC" }, { id: 1768, name: "AP English Language Composition" }, { id: 1022, name: "AP Spanish Language & Culture" }, { id: 757, name: "AP US History" }, { id: 70, name: "AP Statistics" }];
assert.equal(matchCourse("AP Calculus BC", courses), 1769);
assert.equal(matchCourse("AP Calc BC", courses), 1769);
assert.equal(matchCourse("AP Lang & Comp", courses), 1768);
assert.equal(matchCourse("AP Spanish Language", courses), 1022);
assert.equal(matchCourse("AP United States History", courses), 757);
assert.equal(matchCourse("Chemistry Honors", courses), null);
// Real VCS names: PowerSchool vs learn.vcs.net
const vcs = [
  { id: 1769, name: "AP Calculus BC" }, { id: 1234, name: "Service Learning: Justice" }, { id: 1768, name: "AP English Language Composition" },
  { id: 757, name: "AP US History" }, { id: 1340, name: "AP Physics 1" }, { id: 1022, name: "AP Spanish Language & Culture" },
  { id: 1638, name: "Data Structures & Algorithms" }, { id: 70, name: "AP Statistics" },
];
const expect: [string, number | null][] = [
  ["AP Calculus BC", 1769], ["Service Learning: Justice", 1234], ["AP English Language and Comp", 1768], ["AP US History", 757],
  ["Chapel", null], ["AP Physics 1", 1340], ["AP Spanish Language & Culture", 1022], ["Data Structures and Algorithms (H)", 1638], ["AP Statistics", 70],
];
for (const [ps, id] of expect) assert.equal(matchCourse(ps, vcs), id, ps);
console.log("all grades tests passed");
