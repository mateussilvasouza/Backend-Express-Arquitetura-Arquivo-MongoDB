const studentService = require('../services/studentService');

async function create(req, res) {
  const student = await studentService.create(req.body);
  return res.status(201).json(student);
}

async function list(req, res) {
  const students = await studentService.list();
  return res.status(200).json(students);
}

module.exports = { create, list };
