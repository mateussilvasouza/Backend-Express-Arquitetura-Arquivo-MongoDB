const Course = require('../../src/models/Course');
const Student = require('../../src/models/Student');
const Enrollment = require('../../src/models/Enrollment');

let seq = 0;
const uniq = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

function randomCpf() {
  let digits = '';
  for (let i = 0; i < 11; i += 1) digits += Math.floor(Math.random() * 10);
  return digits;
}

const makeStudent = (overrides = {}) =>
  Student.create({
    nome: 'Aluno Teste',
    cpf: randomCpf(),
    email: `aluno-${uniq()}@example.com`,
    dataNascimento: '1990-01-01',
    rendaFamiliar: 3000,
    ...overrides,
  });

const makeCourse = (overrides = {}) =>
  Course.create({
    nome: 'Curso Teste',
    codigo: `C-${uniq()}`,
    idadeMinima: 18,
    capacidadeVagas: 2,
    vagasOcupadas: 0,
    valorMensalidade: 1000,
    status: 'ABERTO',
    ...overrides,
  });

const makeEnrollment = (overrides = {}) =>
  Enrollment.create({
    status: 'CONFIRMADA',
    percentualBolsa: 20,
    valorMensalidadeOriginal: 1000,
    mensalidadeFinal: 800,
    ...overrides,
  });

module.exports = { makeStudent, makeCourse, makeEnrollment, randomCpf, uniq };
