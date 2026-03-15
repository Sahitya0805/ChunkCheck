require("dotenv").config();

const { sendAnalysis } = require("./_shared");

module.exports = async function handler(req, res) {
  return sendAnalysis(req, res);
};
