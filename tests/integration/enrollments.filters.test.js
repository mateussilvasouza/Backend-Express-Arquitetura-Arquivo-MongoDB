const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../src/app');
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

async function seed() {
  const [a1, a2] = await Promise.all([makeStudent(), makeStudent()]);
  const [c1, c2] = await Promise.all([makeCourse(), makeCourse()]);

  await makeEnrollment({ alunoId: a1.id, cursoId: c1.id, status: 'CONFIRMADA' });
  await makeEnrollment({ alunoId: a2.id, cursoId: c1.id, status: 'FILA_ESPERA' });
  await makeEnrollment({ alunoId: a1.id, cursoId: c2.id, status: 'CANCELADA' });

  return { a1, a2, c1, c2 };
}

describe('GET /enrollments', () => {
  it('sem filtro retorna todas ordenadas por createdAt asc', async () => {
    await seed();
    const res = await request(app).get('/enrollments');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    const times = res.body.map((e) => new Date(e.createdAt).getTime());
    expect(times).toEqual([...times].sort((x, y) => x - y));
  });

  it('filtra por cursoId', async () => {
    const { c1 } = await seed();
    const res = await request(app).get('/enrollments').query({ cursoId: String(c1.id) });
    expect(res.body).toHaveLength(2);
    expect(res.body.every((e) => e.cursoId === String(c1.id))).toBe(true);
  });

  it('filtra por alunoId', async () => {
    const { a1 } = await seed();
    const res = await request(app).get('/enrollments').query({ alunoId: String(a1.id) });
    expect(res.body).toHaveLength(2);
  });

  it('filtra por status', async () => {
    await seed();
    const res = await request(app).get('/enrollments').query({ status: 'CONFIRMADA' });
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('CONFIRMADA');
  });

  it('combina cursoId + status', async () => {
    const { c1 } = await seed();
    const res = await request(app)
      .get('/enrollments')
      .query({ cursoId: String(c1.id), status: 'FILA_ESPERA' });
    expect(res.body).toHaveLength(1);
  });

  it('400 para status inválido', async () => {
    expectError(await request(app).get('/enrollments').query({ status: 'BANANA' }), 400, 'VALIDATION_ERROR');
  });

  it('400 para cursoId malformado', async () => {
    expectError(await request(app).get('/enrollments').query({ cursoId: 'abc' }), 400, 'INVALID_OBJECT_ID');
  });

  it('lista vazia quando nada casa o filtro', async () => {
    await seed();
    const res = await request(app).get('/enrollments').query({ cursoId: String(new mongoose.Types.ObjectId()) });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
