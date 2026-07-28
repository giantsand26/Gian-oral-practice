import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveSourceDateTime,
  normalizeReportSourceTime,
  SOURCE_DATE_SENTINEL,
  SOURCE_TIME_SENTINEL,
} from "../server/source-time.mjs";

const now = Date.parse("2026-12-31T23:59:59Z");

test("derives deterministic report date and time from trusted source metadata", () => {
  assert.deepEqual(
    deriveSourceDateTime(
      Date.parse("2026-07-28T09:57:06Z") / 1000,
      "Asia/Shanghai",
      now,
    ),
    { date: "2026-07-28", time: "17:57" },
  );
  assert.deepEqual(
    deriveSourceDateTime(
      Date.parse("2026-07-28T16:05:00Z") / 1000,
      "Asia/Shanghai",
      now,
    ),
    { date: "2026-07-29", time: "00:05" },
  );
});

test("uses IANA timezone rules across DST boundaries", () => {
  assert.deepEqual(
    deriveSourceDateTime(
      Date.parse("2026-03-08T06:59:00Z") / 1000,
      "America/New_York",
      now,
    ),
    { date: "2026-03-08", time: "01:59" },
  );
  assert.deepEqual(
    deriveSourceDateTime(
      Date.parse("2026-03-08T07:00:00Z") / 1000,
      "America/New_York",
      now,
    ),
    { date: "2026-03-08", time: "03:00" },
  );
});

test("normalizes only exact sentinels and binds the real source turn", () => {
  const report = {
    id: "report-1",
    date: SOURCE_DATE_SENTINEL,
    time: SOURCE_TIME_SENTINEL,
  };
  assert.deepEqual(
    normalizeReportSourceTime(report, {
      sourceTurnId: "model-message-1",
      startedAtSeconds: Date.parse("2026-07-28T09:57:06Z") / 1000,
      timeZone: "Asia/Shanghai",
      nowMs: now,
    }),
    {
      id: "report-1",
      date: "2026-07-28",
      time: "17:57",
      sourceTurnId: "model-message-1",
    },
  );
  for (const time of ["unknown", "source_message_time", " SOURCE_MESSAGE_TIME"]) {
    assert.throws(() =>
      normalizeReportSourceTime(
        { ...report, time },
        {
          sourceTurnId: "model-message-1",
          startedAtSeconds: Date.parse("2026-07-28T09:57:06Z") / 1000,
          timeZone: "Asia/Shanghai",
          nowMs: now,
        },
      ),
    );
  }
});

test("rejects missing metadata and invalid timezones", () => {
  assert.throws(() => deriveSourceDateTime(undefined, "Asia/Shanghai", now));
  assert.throws(() =>
    deriveSourceDateTime(
      Date.parse("2026-07-28T09:57:06Z") / 1000,
      "Not/A_Zone",
      now,
    ),
  );
});
