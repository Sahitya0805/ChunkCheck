const { sendHealth } = require("./_shared");

module.exports = function handler(req, res) {
  return sendHealth(req, res);
};
