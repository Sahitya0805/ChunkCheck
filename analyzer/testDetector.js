const TEST_PATH_PATTERNS = [
  /(^|\/)__tests__(\/|$)/i,
  /(^|\/)tests?(\/|$)/i,
  /(^|\/)spec(\/|$)/i,
  /\.test\.[a-z0-9]+$/i,
  /\.spec\.[a-z0-9]+$/i,
  /_test\.[a-z0-9]+$/i,
  /_spec\.[a-z0-9]+$/i,
  /test_[a-z0-9_]+\.[a-z0-9]+$/i,
  /spec_[a-z0-9_]+\.[a-z0-9]+$/i
];

function detectTests(files) {
  return files.some((file) =>
    TEST_PATH_PATTERNS.some((pattern) => pattern.test(file.filename))
  );
}

module.exports = detectTests;
