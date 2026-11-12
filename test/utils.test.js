const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePullRequestUrl } = require("../utils/parsePrUrl");
const detectTests = require("../analyzer/testDetector");
const checkCIStatus = require("../analyzer/ciChecker");
const { scoreBadge, badgeColor } = require("../utils/badge");

test("parses a GitHub pull request URL", () => {
  assert.deepEqual(parsePullRequestUrl("https://github.com/checkstyle/checkstyle/pull/21799"), {
    owner: "checkstyle",
    repo: "checkstyle",
    prNumber: 21799
  });
});

test("rejects URLs that are not pull requests", () => {
  assert.throws(() => parsePullRequestUrl("https://github.com/o/r/issues/1"), /Unable to parse PR URL/);
  assert.throws(() => parsePullRequestUrl("https://gitlab.com/o/r/pull/1"), /Unable to parse PR URL/);
  assert.throws(() => parsePullRequestUrl("not a url"), /Unable to parse PR URL/);
});

test("detects test files across conventions", () => {
  for (const name of ["src/__tests__/a.js", "tests/test_api.py", "lib/a.spec.ts", "pkg/a_test.go"]) {
    assert.equal(detectTests([{ filename: name }]), true, name);
  }
  assert.equal(detectTests([{ filename: "src/index.js" }]), false);
});

test("CI status from check runs and commit statuses", () => {
  assert.equal(checkCIStatus(null, { check_runs: [{ status: "completed", conclusion: "success" }] }).summary, "passing");
  assert.equal(checkCIStatus(null, { check_runs: [{ status: "completed", conclusion: "failure" }] }).summary, "failing");
  assert.equal(checkCIStatus(null, { check_runs: [{ status: "in_progress", conclusion: null }] }).summary, "pending");
  assert.equal(checkCIStatus({ state: "success" }, { check_runs: [] }).summary, "passing");
  assert.equal(checkCIStatus(null, null).summary, "unknown");
});

test("badge shows the score and escapes text", () => {
  const svg = scoreBadge(83);
  assert.match(svg, /^<svg/);
  assert.match(svg, /83\/100/);
  assert.equal(badgeColor(90), "#4c9a2a");
  assert.match(scoreBadge(null), /unavailable/);
});
