import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

const reportPath = process.argv[2];
if (!reportPath) {
  console.error("Usage: node server/import-report.mjs <report.json>");
  process.exit(2);
}

const appDirectory = path.resolve(import.meta.dirname, "..");
const dataDirectory = path.resolve(
  process.env.GIAN_DATA_DIR || path.join(appDirectory, ".runtime"),
);
const inboxDirectory = path.join(dataDirectory, "incoming");
await mkdir(inboxDirectory, { recursive: true, mode: 0o700 });
const resolvedInbox = await realpath(inboxDirectory);
const suppliedPath = path.resolve(reportPath);
const suppliedInfo = await lstat(suppliedPath);
if (suppliedInfo.isSymbolicLink() || !suppliedInfo.isFile()) {
  throw new Error("report must be a regular JSON file");
}
if (suppliedInfo.size > 256 * 1024) {
  throw new Error("report file is too large");
}
const resolvedReport = await realpath(suppliedPath);
const relativeReportPath = path.relative(resolvedInbox, resolvedReport);
if (
  relativeReportPath === "" ||
  relativeReportPath.startsWith("..") ||
  path.isAbsolute(relativeReportPath)
) {
  throw new Error("report must be inside the private incoming directory");
}
const payload = JSON.parse(await readFile(resolvedReport, "utf8"));
if (
  typeof payload.id !== "string" ||
  !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(payload.id)
) {
  throw new Error("report id is invalid");
}
if (path.basename(resolvedReport) !== `${payload.id}.json`) {
  throw new Error("report filename must exactly match its id");
}
const token = (
  await readFile(path.join(dataDirectory, "ingest-token"), "utf8")
).trim();
if (!/^[a-f0-9]{64}$/.test(token)) {
  throw new Error("ingest token is invalid");
}
const port = Number(process.env.GIAN_API_PORT || 8787);

const response = await fetch(`http://127.0.0.1:${port}/api/practices`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
const result = await response.json();

if (response.status === 409 && result.duplicate === true) {
  console.log(JSON.stringify({ ok: true, duplicate: true, ...result }));
  process.exit(0);
}
if (!response.ok) {
  console.error(JSON.stringify(result));
  process.exit(1);
}

console.log(JSON.stringify(result));
