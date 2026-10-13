
const reports = require('../models/taskReportModel');

exports.getSummary = async (req, res) => {
  const summary = await reports.getSummary();

  return res.json({ summary });
};
