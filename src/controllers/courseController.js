const Course = require('../models/Course');

async function list(req, res) {
  const courses = await Course.find().lean();
  return res.status(200).json(courses);
}

module.exports = { list };
