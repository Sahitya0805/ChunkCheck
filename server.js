require("dotenv").config();

const path = require("path");
const express = require("express");

const { sendAnalysis, sendHealth } = require("./api/_shared");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", sendHealth);
app.get("/api/health", sendHealth);
app.get("/analyze", sendAnalysis);
app.get("/api/analyze", sendAnalysis);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`ChunkCheck listening on port ${port}`);
  });
}

module.exports = app;
