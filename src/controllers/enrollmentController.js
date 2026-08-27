const enrollmentService = require('../services/enrollmentService');

async function create(req, res) {
  const enrollment = await enrollmentService.create(req.body);
  return res.status(201).json(enrollment);
}

async function list(req, res) {
  const enrollments = await enrollmentService.list(req.query);
  return res.status(200).json(enrollments);
}

async function cancel(req, res) {
  const enrollment = await enrollmentService.cancel(req.params.id);
  return res.status(200).json(enrollment);
}

module.exports = { create, list, cancel };
