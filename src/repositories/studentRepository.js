const Student = require('../models/Student');

function create(data) {
  return Student.create(data);
}

function findById(id) {
  return Student.findById(id);
}

function findByCpf(cpf) {
  return Student.findOne({ cpf });
}

function findByEmail(email) {
  return Student.findOne({ email });
}

function list() {
  return Student.find().sort({ createdAt: 1 });
}

module.exports = { create, findById, findByCpf, findByEmail, list };
