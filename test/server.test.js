const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../server");

test("health and input validation endpoints", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok", service: "ChunkCheck" });

  const missing = await fetch(`${base}/api/analyze`);
  assert.equal(missing.status, 400);

  const badUrl = await fetch(`${base}/api/analyze?url=not-a-url`);
  assert.equal(badUrl.status, 400);
});
