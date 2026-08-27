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

beforeAll(async () => {
  await connectTestDatabase();
  await syncIndexes();
});
afterEach(clearTestDatabase);
afterAll(disconnectTestDatabase);

const enroll = (alunoId, cursoId) =>
  request(app).post('/enrollments').send({ alunoId: String(alunoId), cursoId: String(cursoId) });

describe('concorrência — capacidade (INV-1/INV-2/INV-4)', () => {
  it.each([
    [1, 2],
    [3, 8],
  ])('capacidade %i com %i requisições simultâneas mantém a capacidade', async (cap, n) => {
    const curso = await makeCourse({ capacidadeVagas: cap, vagasOcupadas: 0, idadeMinima: 0 });
    const alunos = await Promise.all(Array.from({ length: n }, () => makeStudent()));

    const results = await Promise.all(alunos.map((a) => enroll(a.id, curso.id)));

    const statuses = results.map((r) => r.body.status);
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(statuses.filter((s) => s === 'CONFIRMADA')).toHaveLength(cap);
    expect(statuses.filter((s) => s === 'FILA_ESPERA')).toHaveLength(n - cap);

    const atual = await Course.findById(curso.id);
    expect(atual.vagasOcupadas).toBe(cap);
    expect(await Enrollment.countDocuments({ cursoId: curso.id, status: 'CONFIRMADA' })).toBe(cap);
  });
});

describe('concorrência — cancelamento (INV-5)', () => {
  it('dois cancel simultâneos na mesma CONFIRMADA: uma promoção, sem duplo efeito', async () => {
    const curso = await makeCourse({ capacidadeVagas: 1, vagasOcupadas: 1, idadeMinima: 0 });
    const [titular, naFila] = await Promise.all([makeStudent(), makeStudent()]);
    const confirmada = await makeEnrollment({ alunoId: titular.id, cursoId: curso.id, status: 'CONFIRMADA' });
    await makeEnrollment({ alunoId: naFila.id, cursoId: curso.id, status: 'FILA_ESPERA' });

    const results = await Promise.all([
      request(app).patch(`/enrollments/${confirmada.id}/cancel`),
      request(app).patch(`/enrollments/${confirmada.id}/cancel`),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 200]);
    expect(await Enrollment.countDocuments({ cursoId: curso.id, status: 'CONFIRMADA' })).toBe(1);
    expect((await Course.findById(curso.id)).vagasOcupadas).toBe(1);
  });

  it('dois cancel simultâneos na mesma CONFIRMADA sem fila: um decremento apenas', async () => {
    const curso = await makeCourse({ capacidadeVagas: 2, vagasOcupadas: 1, idadeMinima: 0 });
    const aluno = await makeStudent();
    const confirmada = await makeEnrollment({ alunoId: aluno.id, cursoId: curso.id, status: 'CONFIRMADA' });

    const results = await Promise.all([
      request(app).patch(`/enrollments/${confirmada.id}/cancel`),
      request(app).patch(`/enrollments/${confirmada.id}/cancel`),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 200]);
    expect((await Course.findById(curso.id)).vagasOcupadas).toBe(0);
  });
});

describe('concorrência — matrícula ativa duplicada (INV-3)', () => {
  it('dois POST idênticos simultâneos: um 201, um 409, e a vaga não vaza', async () => {
    const curso = await makeCourse({ capacidadeVagas: 5, vagasOcupadas: 0, idadeMinima: 0 });
    const aluno = await makeStudent();

    const [a, b] = await Promise.all([enroll(aluno.id, curso.id), enroll(aluno.id, curso.id)]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);

    const ativos = await Enrollment.countDocuments({
      alunoId: aluno.id,
      cursoId: curso.id,
      status: { $in: ['CONFIRMADA', 'FILA_ESPERA'] },
    });
    expect(ativos).toBe(1);
    expect((await Course.findById(curso.id)).vagasOcupadas).toBe(1); // compensação desfez o $inc extra
  });
});
