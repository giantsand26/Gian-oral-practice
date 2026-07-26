import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const production = process.argv.includes("--production");
const children = [];
let stopping = false;

function start(command, args, label) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  child.label = label;
  children.push(child);
  return child;
}

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

const api = start(process.execPath, ["server/practice-api.mjs"], "local API");
const web = start(
  npmCommand,
  ["run", production ? "start:web" : "dev:web"],
  "web app",
);
const gateway = production
  ? start(process.execPath, ["server/local-gateway.mjs"], "local gateway")
  : null;

for (const child of [api, web, gateway].filter(Boolean)) {
  child.once("error", (error) => {
    console.error(`${child.label} failed to start:`, error.message);
    stop();
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    if (stopping) return;
    console.error(
      `${child.label} stopped unexpectedly (${signal || `exit ${code ?? 1}`})`,
    );
    stop();
    process.exitCode = code || 1;
  });
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
