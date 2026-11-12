const test = require("node:test");
const assert = require("node:assert/strict");
const scorePR = require("../analyzer/scoringEngine");
const { classifySize, WEIGHTS } = require("../analyzer/scoringEngine");

function makePr({ files = 3, lines = 40, ci = "passing", tests = true, docs = false, commitMessage = "Add retry to fetch" } = {}) {
  const fileList = Array.from({ length: files }, (_, i) => ({ filename: `src/File${i}.js`, status: "modified" }));
  if (tests) fileList[0] = { filename: "test/File.test.js", status: "modified" };
  if (docs) fileList[fileList.length - 1] = { filename: "README.md", status: "modified" };
  return scorePR({
    owner: "o",
    repo: "r",
    prNumber: 1,
    pr: { title: "t", html_url: "https://github.com/o/r/pull/1", user: { login: "u" } },
    files: fileList,
    commits: [{ commit: { message: commitMessage } }],
    metrics: { filesChanged: files, linesChanged: lines, additions: lines, deletions: 0, testsDetected: tests, ciStatus: ci }
  });
}

test("category weights add up to 100", () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test("score always equals the sum of the breakdown", () => {
  for (const options of [{}, { files: 30, lines: 1500, ci: "failing", tests: false }, { ci: "pending" }, { ci: "unknown", docs: true }]) {
    const result = makePr(options);
    const sum = result.breakdown.reduce((total, item) => total + item.points, 0);
    assert.equal(result.score, sum);
    for (const item of result.breakdown) {
      assert.ok(item.points >= 0 && item.points <= item.max, `${item.key} within range`);
    }
  }
});

test("a small, tested, green PR with docs scores 100", () => {
  assert.equal(makePr({ docs: true }).score, 100);
});

test("failing CI and missing tests are reported once each", () => {
  const result = makePr({ ci: "failing", tests: false });
  assert.ok(result.analysis.includes("CI is failing."));
  assert.ok(result.analysis.some((r) => r.includes("without any test changes")));
  assert.equal(new Set(result.suggestions).size, result.suggestions.length);
});

test("many files with few lines is Medium and never praised as compact", () => {
  const result = makePr({ files: 23, lines: 70 });
  assert.equal(result.sizeClass, "Medium");
  assert.ok(!result.strengths.some((s) => s.startsWith("Compact diff")));
});

test("classifySize boundaries", () => {
  assert.equal(classifySize(100, 3), "Compact");
  assert.equal(classifySize(300, 3), "Medium");
  assert.equal(classifySize(501, 3), "Large");
  assert.equal(classifySize(260, 25), "Large");
});

test("vague commit messages lose commit points", () => {
  const result = makePr({ commitMessage: "wip" });
  const commits = result.breakdown.find((b) => b.key === "commits");
  assert.ok(commits.points < commits.max);
});
