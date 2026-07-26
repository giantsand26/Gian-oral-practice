import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const sampleReport = {
  id: "practice-2026-07-25-test",
  date: "2026-07-25",
  time: "18:30",
  topic: "Testing the push workflow",
  cefr: "B1+ → B2",
  overall: 7.2,
  scores: [
    { name: "Fluency", score: 7, level: "B1+" },
    { name: "Grammar", score: 6.5, level: "B1+" },
    { name: "Vocabulary", score: 7.5, level: "B2" },
    { name: "Pronunciation", score: 7, level: "B1+" },
    { name: "Content", score: 8, level: "B2" },
  ],
  summary: "A complete test report for the local ingestion workflow.",
  errors: [
    {
      type: "Grammar · Verb form",
      original: "I am practice every day.",
      corrected: "I practise every day.",
      reason: "Use the verb form after the subject.",
      memory: "I practise every day.",
    },
  ],
  sentences: [
    {
      text: "Consistent practice makes a difference.",
      zh: "持续练习会带来改变。",
      scene: "总结学习习惯",
      phrase: "make a difference",
    },
  ],
  sourceTurnId: "test-source-turn",
};

async function startApi() {
  const dataDirectory = await mkdtemp(
    path.join(tmpdir(), "gian-practice-api-test-"),
  );
  const child = spawn(process.execPath, ["server/practice-api.mjs"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: {
      ...process.env,
      GIAN_API_PORT: "0",
      GIAN_DATA_DIR: dataDirectory,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const baseUrl = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(new Error(`API start timed out: ${output}`)),
      5000,
    );
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const match = output.match(
        /Gian Oral Practice API listening on (http:\/\/127\.0\.0\.1:\d+)/,
      );
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`API exited with code ${code}: ${output}`));
      }
    });
  });
  const token = (await readFile(path.join(dataDirectory, "ingest-token"), "utf8"))
    .trim();
  return { baseUrl, child, dataDirectory, token };
}

test("securely stores, lists and deduplicates complete practice reports", async () => {
  const api = await startApi();
  try {
    const health = await fetch(`${api.baseUrl}/api/health`);
    assert.equal(health.status, 200);

    const unauthorized = await fetch(`${api.baseUrl}/api/practices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleReport),
    });
    assert.equal(unauthorized.status, 401);

    const incomplete = await fetch(`${api.baseUrl}/api/practices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "incomplete-report" }),
    });
    assert.equal(incomplete.status, 400);

    const created = await fetch(`${api.baseUrl}/api/practices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sampleReport),
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).id, sampleReport.id);

    const objectScoreReport = {
      ...sampleReport,
      id: "practice-2026-07-25-object-scores",
      sourceTurnId: "test-source-turn-object-scores",
      scores: Object.fromEntries(
        sampleReport.scores.map((score) => [score.name, score]),
      ),
    };
    const objectScoresCreated = await fetch(`${api.baseUrl}/api/practices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(objectScoreReport),
    });
    assert.equal(objectScoresCreated.status, 201);

    const invalidObjectScores = await fetch(`${api.baseUrl}/api/practices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...objectScoreReport,
        id: "practice-2026-07-25-extra-score",
        sourceTurnId: "test-source-turn-extra-score",
        scores: {
          ...objectScoreReport.scores,
          Extra: { name: "Extra", score: 10, level: "C2" },
        },
      }),
    });
    assert.equal(invalidObjectScores.status, 400);

    const duplicate = await fetch(`${api.baseUrl}/api/practices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sampleReport),
    });
    assert.equal(duplicate.status, 409);

    const duplicateSource = await fetch(`${api.baseUrl}/api/practices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...sampleReport,
        id: "practice-2026-07-25-same-source",
      }),
    });
    assert.equal(duplicateSource.status, 409);
    assert.equal((await duplicateSource.json()).conflict, true);

    const importedReport = {
      ...sampleReport,
      id: "practice-2026-07-25-import-script",
      sourceTurnId: "test-source-turn-import-script",
      topic: "Testing the scheduled import command",
    };
    const importedReportPath = path.join(
      api.dataDirectory,
      "incoming",
      `${importedReport.id}.json`,
    );
    await mkdir(path.dirname(importedReportPath), { recursive: true });
    await writeFile(importedReportPath, JSON.stringify(importedReport), "utf8");
    const importEnvironment = {
      ...process.env,
      GIAN_API_PORT: new URL(api.baseUrl).port,
      GIAN_DATA_DIR: api.dataDirectory,
    };
    const imported = await execFileAsync(
      process.execPath,
      ["server/import-report.mjs", importedReportPath],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        env: importEnvironment,
      },
    );
    assert.equal(JSON.parse(imported.stdout).id, importedReport.id);

    const duplicateImport = await execFileAsync(
      process.execPath,
      ["server/import-report.mjs", importedReportPath],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        env: importEnvironment,
      },
    );
    assert.equal(JSON.parse(duplicateImport.stdout).duplicate, true);

    const outsidePath = path.join(
      api.dataDirectory,
      "outside-report.json",
    );
    await writeFile(outsidePath, JSON.stringify(importedReport), "utf8");
    await assert.rejects(
      execFileAsync(process.execPath, ["server/import-report.mjs", outsidePath], {
        cwd: path.resolve(import.meta.dirname, ".."),
        env: importEnvironment,
      }),
      /private incoming directory/,
    );

    const wrongNamePath = path.join(
      api.dataDirectory,
      "incoming",
      "wrong-name.json",
    );
    await writeFile(wrongNamePath, JSON.stringify(importedReport), "utf8");
    await assert.rejects(
      execFileAsync(
        process.execPath,
        ["server/import-report.mjs", wrongNamePath],
        {
          cwd: path.resolve(import.meta.dirname, ".."),
          env: importEnvironment,
        },
      ),
      /filename must exactly match/,
    );

    const listed = await fetch(`${api.baseUrl}/api/practices`);
    assert.equal(listed.status, 200);
    const body = await listed.json();
    assert.equal(body.practices.length, 3);
    assert.equal(
      body.practices.find((item) => item.id === importedReport.id)?.topic,
      importedReport.topic,
    );
    assert.deepEqual(
      body.practices[0].scores.map(([name]) => name),
      ["Fluency", "Grammar", "Vocabulary", "Pronunciation", "Content"],
    );
  } finally {
    api.child.kill("SIGTERM");
    await rm(api.dataDirectory, { recursive: true, force: true });
  }
});
