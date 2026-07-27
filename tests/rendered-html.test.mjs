import assert from "node:assert/strict";
import test from "node:test";

async function fetchFromBuild(pathname = "/", accept = "text/html") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Gian Oral Practice mobile dashboard", async () => {
  const response = await fetchFromBuild();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cache-control"), "private, no-store");

  const html = await response.text();
  assert.match(html, /<title>Gian Oral Practice<\/title>/i);
  assert.match(html, /Latest report/);
  assert.match(html, /CEFR-ALIGNED SPEAKING ASSESSMENT/);
  assert.match(html, /Latest verified report/);
  assert.match(html, /July 3, 2026<!-- --> · <!-- -->19:30/);
  assert.match(html, /LATEST PRACTICE/);
  assert.match(html, /All speaking practices/);
  assert.match(html, /Building a consistent learning habit/);
  assert.match(html, /radar-chart/);
  assert.doesNotMatch(html, /Nong English|Noon English Practice/);
  assert.match(html, /ERRORS TO CORRECT/);
  assert.match(html, /SENTENCES TO REMEMBER/);
  assert.match(html, /CEFR LEVEL GUIDE/);
  assert.match(html, /从 A1 到 C2/);
  assert.match(html, /Latest/);
  assert.match(html, /History/);
  assert.match(html, /Progress/);
  assert.match(html, /Library/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("serves a valid PWA manifest", async () => {
  const response = await fetchFromBuild(
    "/manifest.webmanifest",
    "application/manifest+json",
  );
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/manifest\+json\b/i,
  );
  const manifest = await response.json();
  assert.equal(manifest.name, "Gian Oral Practice");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.icons[0].src, "/icon-512.png");
});
