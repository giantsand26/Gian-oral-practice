import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(serverDirectory, "..");
const dataDirectory = path.resolve(
  process.env.GIAN_DATA_DIR || path.join(appDirectory, ".runtime"),
);
const recordsPath = path.join(dataDirectory, "practices.json");
const tokenPath = path.join(dataDirectory, "ingest-token");
const host = process.env.GIAN_API_HOST || "127.0.0.1";
const port = Number(process.env.GIAN_API_PORT || 8787);
let mutationQueue = Promise.resolve();
const allowedScoreNames = [
  "Fluency",
  "Grammar",
  "Vocabulary",
  "Pronunciation",
  "Content",
];

function sendJson(response, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(body);
}

function cleanText(value, name, maximumLength = 4000) {
  if (typeof value !== "string") {
    throw new Error(`${name} must be text`);
  }
  const cleaned = value
    .replace(/\0/g, "")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
    .trim();
  if (!cleaned || cleaned.length > maximumLength) {
    throw new Error(`${name} must contain 1-${maximumLength} characters`);
  }
  return cleaned;
}

function cleanScore(value, name, allowNull = false) {
  if (allowNull && value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a number`);
  }
  if (value < 0 || value > 10) {
    throw new Error(`${name} must be between 0 and 10`);
  }
  return Math.round(value * 10) / 10;
}

function normalizeScores(value) {
  let entries;
  if (Array.isArray(value)) {
    entries = value;
  } else if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (
      keys.length !== allowedScoreNames.length ||
      keys.some((name) => !allowedScoreNames.includes(name))
    ) {
      throw new Error(
        `scores object must use exactly: ${allowedScoreNames.join(", ")}`,
      );
    }
    entries = allowedScoreNames.map((name) => value[name]);
  } else {
    entries = [];
  }
  if (entries.length !== 5) {
    throw new Error("scores must contain exactly five dimensions");
  }
  const normalized = entries.map((entry, index) => {
    const tuple = Array.isArray(entry)
      ? entry
      : [entry?.name, entry?.score, entry?.level];
    const name = cleanText(tuple[0], `scores[${index}].name`, 40);
    const score = cleanScore(tuple[1], `scores[${index}].score`);
    const level = cleanText(tuple[2], `scores[${index}].level`, 30);
    return [name, score, level];
  });
  const names = normalized.map(([name]) => name);
  if (
    allowedScoreNames.some((name) => !names.includes(name)) ||
    new Set(names).size !== allowedScoreNames.length
  ) {
    throw new Error(
      `scores must use: ${allowedScoreNames.join(", ")}`,
    );
  }
  return allowedScoreNames.map(
    (name) => normalized.find(([entryName]) => entryName === name),
  );
}

function normalizeErrors(value, recordId) {
  if (!Array.isArray(value)) throw new Error("errors must be a list");
  return value.slice(0, 30).map((entry, index) => ({
    id: `${recordId}-error-${index + 1}`,
    type: cleanText(entry?.type, `errors[${index}].type`, 100),
    original: cleanText(entry?.original, `errors[${index}].original`, 1000),
    corrected: cleanText(entry?.corrected, `errors[${index}].corrected`, 1000),
    reason: cleanText(entry?.reason, `errors[${index}].reason`, 2000),
    memory: cleanText(entry?.memory, `errors[${index}].memory`, 500),
  }));
}

function normalizeSentences(value, recordId) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("sentences must contain at least one item");
  }
  if (value.length > 4) {
    throw new Error("sentences must contain 1-4 items");
  }
  return value.map((entry, index) => ({
    id: `${recordId}-sentence-${index + 1}`,
    text: cleanText(entry?.text, `sentences[${index}].text`, 1200),
    zh: cleanText(entry?.zh, `sentences[${index}].zh`, 1200),
    scene: cleanText(entry?.scene, `sentences[${index}].scene`, 300),
    phrase: cleanText(entry?.phrase, `sentences[${index}].phrase`, 300),
  }));
}

function normalizePhrases(value, recordId) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 5) {
    throw new Error("phrases must contain 1-5 items");
  }
  return value.map((entry, index) => ({
    id: `${recordId}-phrase-${index + 1}`,
    text: cleanText(entry?.text, `phrases[${index}].text`, 300),
    zh: cleanText(entry?.zh, `phrases[${index}].zh`, 500),
    example: cleanText(entry?.example, `phrases[${index}].example`, 1200),
  }));
}

function displayDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function calendarDateInTimeZone(instant, timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
  } catch {
    throw new Error("configured timezone is not a valid IANA timezone");
  }
  const value = (type) => parts.find((entry) => entry.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function normalizeRecord(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("request body must be a JSON object");
  }
  if (
    typeof payload.date !== "string" ||
    payload.date !== payload.date.trim()
  ) {
    throw new Error("date must use exact YYYY-MM-DD without whitespace");
  }
  if (
    typeof payload.time !== "string" ||
    payload.time !== payload.time.trim()
  ) {
    throw new Error("time must use exact HH:mm without whitespace");
  }
  const date = cleanText(payload.date, "date", 10);
  const time = cleanText(payload.time, "time", 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("date must use YYYY-MM-DD");
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("time must use HH:mm");
  }
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("date is not a valid calendar date");
  }
  const [hours, minutes] = time.split(":").map(Number);
  if (hours > 23 || minutes > 59) {
    throw new Error("time is not valid");
  }
  if (date < "2020-01-01") {
    throw new Error("practice time is outside the supported range");
  }
  const configuredTimeZone =
    process.env.GIAN_TIMEZONE ||
    process.env.NONG_TIMEZONE ||
    "Asia/Shanghai";
  const maximumDate = calendarDateInTimeZone(
    new Date(Date.now() + 36 * 60 * 60 * 1000),
    configuredTimeZone,
  );
  if (date > maximumDate) {
    throw new Error("practice time cannot be in the future");
  }
  const rawId =
    payload.id ||
    payload.recordId ||
    payload.record_id ||
    `practice-${date}-${time.replace(":", "")}-${createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex")
      .slice(0, 10)}`;
  const id = cleanText(rawId, "id", 120);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) {
    throw new Error("id may only contain letters, numbers, underscore and dash");
  }
  const scores = normalizeScores(payload.scores);
  const average =
    scores.reduce((sum, [, score]) => sum + score, 0) / scores.length;
  const overall = cleanScore(payload.overall, "overall");
  if (Math.abs(overall - average) > 1.5) {
    throw new Error("overall differs too much from the five-score average");
  }
  const cefr = cleanText(payload.cefr, "cefr", 40);
  if (!/\b(?:A1|A2|B1|B2|C1|C2)\b/i.test(cefr)) {
    throw new Error("cefr must include an A1-C2 level");
  }
  const sentences = normalizeSentences(payload.sentences, id);
  return {
    id,
    date,
    displayDate: displayDate(date),
    time,
    topic: cleanText(payload.topic, "topic", 200),
    cefr,
    overall,
    scores,
    summary: cleanText(payload.summary, "summary", 5000),
    errors: normalizeErrors(payload.errors, id),
    sentences,
    phrases: normalizePhrases(payload.phrases, id),
    sourceTurnId: cleanText(
      payload.sourceTurnId || payload.source_turn_id,
      "sourceTurnId",
      200,
    ),
    receivedAt: new Date().toISOString(),
  };
}

async function ensureRuntime() {
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  const directoryInfo = await lstat(dataDirectory);
  if (directoryInfo.isSymbolicLink() || !directoryInfo.isDirectory()) {
    throw new Error("data directory must be a real directory");
  }
  await chmod(dataDirectory, 0o700);
  try {
    await readFile(tokenPath, "utf8");
  } catch {
    await writeFile(tokenPath, `${randomBytes(32).toString("hex")}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  }
  try {
    await readFile(recordsPath, "utf8");
  } catch {
    await writeFile(recordsPath, "[]\n", {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  }
  for (const filePath of [tokenPath, recordsPath]) {
    const info = await lstat(filePath);
    if (info.isSymbolicLink() || !info.isFile()) {
      throw new Error("runtime files must be regular files");
    }
    await chmod(filePath, 0o600);
  }
  const token = (await readFile(tokenPath, "utf8")).trim();
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new Error(
      "ingest-token is invalid; remove it while the service is stopped so a secure token can be regenerated",
    );
  }
}

async function loadRecords() {
  const raw = await readFile(recordsPath, "utf8");
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("practice store is invalid");
  return value;
}

async function saveRecords(records) {
  const temporaryPath = `${recordsPath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, recordsPath);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 256 * 1024) throw new Error("request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function authorized(request) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7).trim());
  const expectedText = (await readFile(tokenPath, "utf8")).trim();
  if (!/^[a-f0-9]{64}$/.test(expectedText)) return false;
  const expected = Buffer.from(expectedText);
  return (
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected)
  );
}

function enqueueMutation(task) {
  const result = mutationQueue.then(task, task);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function hasAllowedHost(request) {
  try {
    const hostname = new URL(
      `http://${request.headers.host || ""}`,
    ).hostname.toLowerCase();
    return hostname === "127.0.0.1" ||
      hostname === "localhost" ||
      hostname === "[::1]";
  } catch {
    return false;
  }
}

function recordContent(record) {
  const content = { ...record };
  delete content.receivedAt;
  return JSON.stringify(content);
}

function browserRecord(record) {
  const result = { ...record };
  delete result.sourceTurnId;
  return result;
}

await ensureRuntime();

const server = createServer(async (request, response) => {
  try {
    if (!hasAllowedHost(request)) {
      sendJson(response, 421, { error: "Host is not allowed" });
      return;
    }
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    const route = url.pathname.replace(/^\/api(?=\/)/, "");

    if (request.method === "GET" && route === "/health") {
      sendJson(response, 200, { ok: true, service: "gian-oral-practice-api" });
      return;
    }

    if (request.method === "GET" && route === "/practices") {
      const records = await loadRecords();
      records.sort((a, b) =>
        `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
      );
      sendJson(response, 200, {
        practices: records.map(browserRecord),
        updatedAt: records[0]?.receivedAt || null,
      });
      return;
    }

    if (request.method === "POST" && route === "/practices") {
      if (!(await authorized(request))) {
        sendJson(response, 401, { error: "Unauthorized" });
        return;
      }
      const record = normalizeRecord(await readBody(request));
      await enqueueMutation(async () => {
        const records = await loadRecords();
        const existing = records.find(
          (item) =>
            item.id === record.id ||
            (item.sourceTurnId && item.sourceTurnId === record.sourceTurnId),
        );
        if (existing && recordContent(existing) === recordContent(record)) {
          sendJson(response, 409, {
            error: "This practice has already been pushed",
            duplicate: true,
            id: existing.id,
          });
          return;
        }
        if (existing) {
          sendJson(response, 409, {
            error: "Report ID or source message conflicts with stored content",
            conflict: true,
            id: existing.id,
          });
          return;
        }
        records.push(record);
        await saveRecords(records);
        sendJson(response, 201, {
          ok: true,
          id: record.id,
          topic: record.topic,
          overall: record.overall,
        });
      });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    sendJson(response, 400, { error: message });
  }
});

server.listen(port, host, () => {
  const address = server.address();
  const activePort =
    address && typeof address === "object" ? address.port : port;
  console.log(`Gian Oral Practice API listening on http://${host}:${activePort}`);
  console.log(`Data directory: ${dataDirectory}`);
});
