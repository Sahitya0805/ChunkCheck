require("dotenv").config();

const path = require("path");
const express = require("express");

const { sendAnalysis } = require("./api/_shared");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ChunkCheck"
  });
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ChunkCheck"
  });
});
app.get("/analyze", sendAnalysis);
app.get("/api/analyze", sendAnalysis);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`ChunkCheck listening on port ${port}`);
  });
}

module.exports = app;
