export const SOURCE_DATE_SENTINEL = "SOURCE_MESSAGE_DATE";
export const SOURCE_TIME_SENTINEL = "SOURCE_MESSAGE_TIME";

function part(parts, type) {
  const value = parts.find((entry) => entry.type === type)?.value;
  if (!value) throw new Error(`source timestamp is missing ${type}`);
  return value;
}

export function deriveSourceDateTime(
  startedAtSeconds,
  timeZone,
  nowMs = Date.now(),
) {
  if (
    typeof startedAtSeconds !== "number" ||
    !Number.isFinite(startedAtSeconds)
  ) {
    throw new Error("startedAt must be a finite epoch-seconds number");
  }
  if (typeof timeZone !== "string" || timeZone.length === 0) {
    throw new Error("timeZone must be a configured IANA timezone");
  }
  const instantMs = startedAtSeconds * 1000;
  if (
    instantMs < Date.UTC(2020, 0, 1) ||
    instantMs > nowMs + 36 * 60 * 60 * 1000
  ) {
    throw new Error("startedAt is outside the supported range");
  }

  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(instantMs));
  } catch {
    throw new Error("timeZone must be a valid IANA timezone");
  }

  const date = `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
  const time = `${part(parts, "hour")}:${part(parts, "minute")}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("derived source date is invalid");
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("derived source time is invalid");
  }
  return { date, time };
}

export function normalizeReportSourceTime(
  report,
  { sourceTurnId, startedAtSeconds, timeZone, nowMs },
) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new Error("report must be a JSON object");
  }
  if (
    report.date !== SOURCE_DATE_SENTINEL ||
    report.time !== SOURCE_TIME_SENTINEL
  ) {
    throw new Error("report must use the exact source date/time sentinels");
  }
  if (typeof sourceTurnId !== "string" || sourceTurnId.length === 0) {
    throw new Error("sourceTurnId must come from the report model message");
  }
  const derived = deriveSourceDateTime(startedAtSeconds, timeZone, nowMs);
  return { ...report, ...derived, sourceTurnId };
}
