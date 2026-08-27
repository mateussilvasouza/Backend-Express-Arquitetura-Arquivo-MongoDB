const request = require('supertest');
const app = require('../../src/app');
const Student = require('../../src/models/Student');
const {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase,
  syncIndexes,
} = require('../helpers/mongo');
const { makeStudent } = require('../helpers/factories');
const { daysFromNow } = require('../helpers/dates');
const { expectError } = require('../helpers/assertions');

const validPayload = (overrides = {}) => ({
  nome: 'Maria Silva',
  cpf: '123.456.789-00',
  email: 'maria@example.com',
  dataNascimento: '2000-08-20',
  rendaFamiliar: 2824.0,
  ...overrides,
});

beforeAll(async () => {
  await connectTestDatabase();
  await syncIndexes();
});
afterEach(clearTestDatabase);
afterAll(disconnectTestDatabase);

describe('POST /students', () => {
  it('cria o aluno com 201 e normaliza cpf e email', async () => {
    const res = await request(app)
      .post('/students')
      .send(validPayload({ email: '  Maria@Example.com  ', cpf: '123.456.789-00' }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nome: 'Maria Silva',
      cpf: '12345678900',
      email: 'maria@example.com',
      dataNascimento: '2000-08-20',
      rendaFamiliar: 2824.0,
    });
    expect(res.body.id).toBeDefined();
    expect(res.body._id).toBeUndefined();

    expect(await Student.countDocuments()).toBe(1);
  });

  it.each([
    ['falta nome', { nome: undefined }],
    ['nome vazio', { nome: '   ' }],
    ['cpf com menos de 11 dígitos', { cpf: '123' }],
    ['email sem formato válido', { email: 'nao-e-email' }],
    ['dataNascimento fora do formato', { dataNascimento: '20/08/2000' }],
    ['dataNascimento inexistente', { dataNascimento: '2001-02-29' }],
    ['dataNascimento no futuro', { dataNascimento: daysFromNow(1) }],
    ['rendaFamiliar negativa', { rendaFamiliar: -1 }],
    ['rendaFamiliar com 3 casas decimais', { rendaFamiliar: 100.123 }],
  ])('rejeita payload inválido: %s', async (_label, patch) => {
    const res = await request(app).post('/students').send(validPayload(patch));
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('409 quando o cpf já existe (mesmo com pontuação diferente)', async () => {
    await request(app).post('/students').send(validPayload({ cpf: '111.222.333-44' }));

    const res = await request(app)
      .post('/students')
      .send(validPayload({ cpf: '11122233344', email: 'outro@example.com' }));

    expectError(res, 409, 'DUPLICATE_CPF');
  });

  it('409 quando o email já existe (case/espaços diferentes)', async () => {
    await request(app).post('/students').send(validPayload({ email: 'maria@example.com' }));

    const res = await request(app)
      .post('/students')
      .send(validPayload({ email: '  MARIA@example.com ', cpf: '999.888.777-66' }));

    expectError(res, 409, 'DUPLICATE_EMAIL');
  });
});

describe('GET /students', () => {
  it('lista os alunos cadastrados com 200', async () => {
    await makeStudent({ nome: 'A' });
    await makeStudent({ nome: 'B' });

    const res = await request(app).get('/students');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((s) => s.nome).sort()).toEqual(['A', 'B']);
  });
});
