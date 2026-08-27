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
const { birthdateForAge } = require('../helpers/dates');
const { expectError } = require('../helpers/assertions');

beforeAll(async () => {
  await connectTestDatabase();
  await syncIndexes();
});
afterEach(clearTestDatabase);
afterAll(disconnectTestDatabase);

const enroll = (alunoId, cursoId) =>
  request(app).post('/enrollments').send({ alunoId: String(alunoId), cursoId: String(cursoId) });

describe('POST /enrollments', () => {
  it('cria CONFIRMADA e ocupa uma vaga quando há disponibilidade', async () => {
    const aluno = await makeStudent({ dataNascimento: birthdateForAge(30), rendaFamiliar: 2824.0 });
    const curso = await makeCourse({ capacidadeVagas: 2, vagasOcupadas: 0, valorMensalidade: 1000 });

    const res = await enroll(aluno.id, curso.id);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'CONFIRMADA',
      percentualBolsa: 50,
      mensalidadeFinal: 500,
      valorMensalidadeOriginal: 1000,
    });
    expect((await Course.findById(curso.id)).vagasOcupadas).toBe(1);
  });

  it('cria FILA_ESPERA sem alterar vagasOcupadas quando o curso está lotado', async () => {
    const aluno = await makeStudent({ dataNascimento: birthdateForAge(30) });
    const curso = await makeCourse({ capacidadeVagas: 1, vagasOcupadas: 1 });

    const res = await enroll(aluno.id, curso.id);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('FILA_ESPERA');
    expect((await Course.findById(curso.id)).vagasOcupadas).toBe(1);
  });

  it('422 quando o aluno não tem a idade mínima', async () => {
    const aluno = await makeStudent({ dataNascimento: birthdateForAge(18, 1) }); // faz 18 amanhã
    const curso = await makeCourse({ idadeMinima: 18 });

    expectError(await enroll(aluno.id, curso.id), 422, 'MINIMUM_AGE_NOT_MET');
  });

  it('aceita a matrícula no dia exato do aniversário', async () => {
    const aluno = await makeStudent({ dataNascimento: birthdateForAge(18, 0) });
    const curso = await makeCourse({ idadeMinima: 18 });

    expect((await enroll(aluno.id, curso.id)).status).toBe(201);
  });

  it('422 quando o curso não está ABERTO', async () => {
    const aluno = await makeStudent({ dataNascimento: birthdateForAge(30) });
    const curso = await makeCourse({ status: 'ENCERRADO' });

    expectError(await enroll(aluno.id, curso.id), 422, 'COURSE_NOT_OPEN');
  });

  it('404 quando o aluno não existe', async () => {
    const curso = await makeCourse();
    expectError(await enroll(new mongoose.Types.ObjectId(), curso.id), 404, 'STUDENT_NOT_FOUND');
  });

  it('404 quando o curso não existe', async () => {
    const aluno = await makeStudent({ dataNascimento: birthdateForAge(30) });
    expectError(await enroll(aluno.id, new mongoose.Types.ObjectId()), 404, 'COURSE_NOT_FOUND');
  });

  it('400 quando o ObjectId é malformado', async () => {
    expectError(await enroll('nao-e-objectid', new mongoose.Types.ObjectId()), 400, 'INVALID_OBJECT_ID');
  });

  it('400 quando falta um campo do payload', async () => {
    const res = await request(app).post('/enrollments').send({ alunoId: String(new mongoose.Types.ObjectId()) });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('409 quando já existe matrícula ativa do aluno no curso', async () => {
    const aluno = await makeStudent({ dataNascimento: birthdateForAge(30) });
    const curso = await makeCourse({ capacidadeVagas: 5 });
    await makeEnrollment({ alunoId: aluno.id, cursoId: curso.id, status: 'CONFIRMADA' });

    expectError(await enroll(aluno.id, curso.id), 409, 'DUPLICATE_ACTIVE_ENROLLMENT');
  });

  it('permite nova matrícula após um cancelamento', async () => {
    const aluno = await makeStudent({ dataNascimento: birthdateForAge(30) });
    const curso = await makeCourse({ capacidadeVagas: 5 });
    await makeEnrollment({ alunoId: aluno.id, cursoId: curso.id, status: 'CANCELADA' });

    expect((await enroll(aluno.id, curso.id)).status).toBe(201);
  });

  it('congela a bolsa/mensalidade da matrícula (INV-7)', async () => {
    const aluno = await makeStudent({ dataNascimento: birthdateForAge(30), rendaFamiliar: 3000 });
    const curso = await makeCourse({ valorMensalidade: 1000, capacidadeVagas: 5 });

    const { body } = await enroll(aluno.id, curso.id);
    expect(body.mensalidadeFinal).toBe(800); // 20% de bolsa

    await Course.updateOne({ _id: curso.id }, { $set: { valorMensalidade: 4000 } });

    const stored = await Enrollment.findById(body.id);
    expect(stored.mensalidadeFinal).toBe(800);
    expect(stored.valorMensalidadeOriginal).toBe(1000);
  });

  it.each([
    [2824.0, 50, 500],
    [5000, 20, 800],
    [9000, 0, 1000],
  ])('aplica a faixa de bolsa para renda %p', async (renda, pct, final) => {
    const aluno = await makeStudent({ dataNascimento: birthdateForAge(30), rendaFamiliar: renda });
    const curso = await makeCourse({ valorMensalidade: 1000, capacidadeVagas: 5 });

    const { body } = await enroll(aluno.id, curso.id);
    expect(body).toMatchObject({ percentualBolsa: pct, mensalidadeFinal: final });
  });
});
