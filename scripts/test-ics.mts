import assert from "node:assert/strict";
import { parseIcs } from "../src/lib/ics.ts";
const TZ = "America/Los_Angeles";
const ics = [
  "BEGIN:VCALENDAR", "X-WR-CALNAME:High School Portal",
  "BEGIN:VEVENT", "UID:a1", "DTSTART;VALUE=DATE:20261125", "DTEND;VALUE=DATE:20261128", "SUMMARY:No School - Thanksgiving Break", "END:VEVENT",
  "BEGIN:VEVENT", "UID:a2", "DTSTART:20261120T020000Z", "DTEND:20261120T040000Z", "SUMMARY:Emerge: The Twelve Days", "  of Christmas", "LOCATION:Theater\\, Main", "END:VEVENT",
  "BEGIN:VEVENT", "UID:a3", "DTSTART;TZID=America/New_York:20261201T120000", "DTEND;TZID=America/New_York:20261201T130000", "SUMMARY:East coast call", "END:VEVENT",
  "BEGIN:VEVENT", "UID:a4", "DTSTART;VALUE=DATE:20261119", "SUMMARY:HS A Day", "END:VEVENT",
  "BEGIN:VEVENT", "UID:a5", "DTSTART:20261201T170000Z", "DTEND:20261201T180000Z", "RRULE:FREQ=WEEKLY;UNTIL=20270101T000000Z", "SUMMARY:Club", "END:VEVENT",
  "BEGIN:VEVENT", "UID:a6", "STATUS:CANCELLED", "DTSTART;VALUE=DATE:20261202", "SUMMARY:Cancelled", "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");
const { name, events } = parseIcs(ics, TZ);
assert.equal(name, "High School Portal");
assert.equal(events.length, 5);
const by = Object.fromEntries(events.map((e) => [e.uid, e]));
assert.deepEqual([by.a1.allDay, by.a1.start, by.a1.end], [true, "2026-11-25T00:00", "2026-11-28T00:00"]);
assert.deepEqual([by.a2.start, by.a2.end, by.a2.title, by.a2.location], ["2026-11-19T18:00", "2026-11-19T20:00", "Emerge: The Twelve Days of Christmas", "Theater, Main"]);
assert.deepEqual([by.a3.start, by.a3.end], ["2026-12-01T09:00", "2026-12-01T10:00"]);
assert.deepEqual([by.a4.start, by.a4.end], ["2026-11-19T00:00", "2026-11-20T00:00"]);
assert.deepEqual(by.a5.recurrence, { freq: "weekly", until: "2026-12-31" });
// window filter
assert.equal(parseIcs(ics, TZ, "2026-11-26", "2026-11-30").events.map((e) => e.uid).join(), "a1");
assert.equal(parseIcs(ics, TZ, "2026-12-08", "2026-12-20").events.map((e) => e.uid).join(), "a5");
console.log("all ics tests passed");
