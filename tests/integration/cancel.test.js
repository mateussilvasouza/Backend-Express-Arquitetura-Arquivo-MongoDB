const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../src/app');
const Course = require('../../src/models/Course');
const Enrollment = require('../../src/models/Enrollment');
const {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase,
  syncIndexes,
} = require('../helpers/mongo');
const { makeStudent, makeCourse, makeEnrollment } = require('../helpers/factories');
const { expectError } = require('../helpers/assertions');

beforeAll(async () => {
  await connectTestDatabase();
  await syncIndexes();
});
afterEach(clearTestDatabase);
afterAll(disconnectTestDatabase);

const cancel = (id) => request(app).patch(`/enrollments/${id}/cancel`);

// createdAt explícito (mongoose sobrescreve no create quando timestamps: true)
const setCreatedAt = (id, date) =>
  Enrollment.updateOne({ _id: id }, { $set: { createdAt: date } }, { timestamps: false });

async function courseSeats(id) {
  return (await Course.findById(id)).vagasOcupadas;
}

describe('PATCH /enrollments/:id/cancel', () => {
  it('cancela CONFIRMADA e promove o primeiro da fila (FIFO); vagasOcupadas estável', async () => {
    const curso = await makeCourse({ capacidadeVagas: 1, vagasOcupadas: 1 });
    const [titular, primeiro, segundo] = await Promise.all([makeStudent(), makeStudent(), makeStudent()]);

    const confirmada = await makeEnrollment({ alunoId: titular.id, cursoId: curso.id, status: 'CONFIRMADA' });
    const early = await makeEnrollment({ alunoId: primeiro.id, cursoId: curso.id, status: 'FILA_ESPERA' });
    const late = await makeEnrollment({ alunoId: segundo.id, cursoId: curso.id, status: 'FILA_ESPERA' });
    await setCreatedAt(early.id, new Date('2020-01-01T00:00:00Z'));
    await setCreatedAt(late.id, new Date('2020-06-01T00:00:00Z'));

    const res = await cancel(confirmada.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELADA');
    expect((await Enrollment.findById(early.id)).status).toBe('CONFIRMADA');
    expect((await Enrollment.findById(late.id)).status).toBe('FILA_ESPERA');
    expect(await courseSeats(curso.id)).toBe(1); // uma saiu, uma entrou
  });

  it('cancela CONFIRMADA sem fila: decrementa vagasOcupadas uma vez', async () => {
    const curso = await makeCourse({ capacidadeVagas: 2, vagasOcupadas: 1 });
    const aluno = await makeStudent();
    const confirmada = await makeEnrollment({ alunoId: aluno.id, cursoId: curso.id, status: 'CONFIRMADA' });

    const res = await cancel(confirmada.id);

    expect(res.status).toBe(200);
    expect(await courseSeats(curso.id)).toBe(0);
  });

  it('cancelar FILA_ESPERA não altera vagasOcupadas nem promove ninguém', async () => {
    const curso = await makeCourse({ capacidadeVagas: 1, vagasOcupadas: 1 });
    const [titular, naFila] = await Promise.all([makeStudent(), makeStudent()]);
    const confirmada = await makeEnrollment({ alunoId: titular.id, cursoId: curso.id, status: 'CONFIRMADA' });
    const espera = await makeEnrollment({ alunoId: naFila.id, cursoId: curso.id, status: 'FILA_ESPERA' });

    const res = await cancel(espera.id);

    expect(res.status).toBe(200);
    expect(await courseSeats(curso.id)).toBe(1);
    expect((await Enrollment.findById(confirmada.id)).status).toBe('CONFIRMADA');
  });

  it('matrícula já CANCELADA responde 200 com o estado atual e sem novos efeitos', async () => {
    const curso = await makeCourse({ capacidadeVagas: 2, vagasOcupadas: 1 });
    const aluno = await makeStudent();
    const enr = await makeEnrollment({
      alunoId: aluno.id,
      cursoId: curso.id,
      status: 'CANCELADA',
      canceladaEm: new Date('2020-01-01T00:00:00Z'),
    });

    const res = await cancel(enr.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELADA');
    expect(await courseSeats(curso.id)).toBe(1); // inalterado
    expect((await Enrollment.findById(enr.id)).canceladaEm.toISOString()).toBe('2020-01-01T00:00:00.000Z');
  });

  it('404 quando a matrícula não existe', async () => {
    expectError(await cancel(new mongoose.Types.ObjectId()), 404, 'ENROLLMENT_NOT_FOUND');
  });

  it('400 quando o id é malformado', async () => {
    expectError(await cancel('nao-e-id'), 400, 'INVALID_OBJECT_ID');
  });
});
