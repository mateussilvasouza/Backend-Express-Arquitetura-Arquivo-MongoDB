# 05 — Estratégia de Testes

## Pirâmide

| Camada | O quê | Ferramenta | Fala com Mongo? | Velocidade |
|---|---|---|---|---|
| **Unit** | domínio puro (`scholarship`, `age`) | Jest | não | instantâneo |
| **Integração** | fluxo HTTP real (`app` + rotas + service + repo + Mongo) | Jest + Supertest + `mongodb-memory-server` | sim (em memória) | ~dezenas de ms |
| **Concorrência** | invariantes sob `Promise.all` | idem integração | sim | ~centenas de ms |

Sem mocks de Mongoose. O que dá para testar sem banco (regra pura) fica em `domain/` e é testado isolado; o resto passa pelo banco real em memória — é barato e pega bug de índice/query que mock esconde.

## Infra (já existe, só padronizar)

- `tests/helpers/mongo.js` → `connectTestDatabase` / `clearTestDatabase` / `disconnectTestDatabase`.
- Padrão por arquivo de integração:

```js
beforeAll(connectTestDatabase);
beforeAll(syncAllIndexes);   // NOVO: garante índices (único parcial de matrícula, uniques de aluno)
afterEach(clearTestDatabase);
afterAll(disconnectTestDatabase);
```

- `jest` já roda `--runInBand` (sem paralelismo entre arquivos) → sem disputa pela mesma porta/instância. `testTimeout: 120000` cobre o download do binário na 1ª execução.
- **`syncAllIndexes`** (novo helper): `await Promise.all([Student.syncIndexes(), Enrollment.syncIndexes(), Course.syncIndexes()])`. `clearTestDatabase` só faz `deleteMany`, não dropa índice — mas o 1º teste precisa que o índice exista. Chamar no `beforeAll`.

## Helpers de teste (`tests/helpers/`)

### `factories.js` — montagem de estado direto no model (arrange)

```js
const makeCourse = (o = {}) => Course.create({
  nome: 'Curso X', codigo: `C-${randomId()}`, idadeMinima: 18,
  capacidadeVagas: 2, vagasOcupadas: 0, valorMensalidade: 1000, status: 'ABERTO', ...o,
});

const makeStudent = (o = {}) => Student.create({
  nome: 'Aluno X', cpf: randomCpf(), email: `${randomId()}@ex.com`,
  dataNascimento: '1990-01-01', rendaFamiliar: 3000, ...o,
});

const makeEnrollment = (o = {}) => Enrollment.create({
  status: 'CONFIRMADA', percentualBolsa: 20, valorMensalidadeOriginal: 1000,
  mensalidadeFinal: 800, ...o,   // alunoId, cursoId obrigatórios via override
});
```

Regra: **arrange** monta estado pelo model (rápido, direto). **Act** é sempre via HTTP (`request(app)`). **Assert** verifica resposta HTTP **e** estado final no banco.

### `dates.js` — datas civis relativas

```js
// dataNascimento para alguém que faz `idade` anos daqui a `offsetDias`
const birthdateForAge = (idade, offsetDias = 0) => { /* ... retorna 'YYYY-MM-DD' */ };
birthdateForAge(18, 0)    // faz 18 exatamente hoje  -> aceito
birthdateForAge(18, 1)    // faz 18 amanhã           -> rejeitado (tem 17 hoje)
birthdateForAge(17, -30)  // fez 17 há 30 dias       -> rejeitado
```

### `assertions.js` — asserção do envelope

```js
const expectError = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body).toHaveProperty('error');
  expect(res.body.error).toMatchObject({ code });
  expect(typeof res.body.error.message).toBe('string');
};
```

## Arquivos e cobertura

### `tests/unit/scholarship.test.js`

`it.each` nas fronteiras (comparar em centavos):

| `rendaFamiliar` | `percentualBolsa` | `mensalidadeFinal` (curso 1000) |
|---|---|---|
| `0` | 50 | 500 |
| `2824.00` | 50 | 500 |
| `2824.01` | 20 | 800 |
| `5648.00` | 20 | 800 |
| `5648.01` | 0 | 1000 |

### `tests/unit/age.test.js`

`ageOn(nascimento, hoje)` com `hoje` fixo injetado:

- véspera do aniversário → idade − 1;
- **dia** do aniversário → idade nova (INV-8);
- dia seguinte → idade nova;
- nascido `2004-02-29`, `hoje = 2023-02-28` → 18; `hoje = 2023-03-01` → 19.

### `tests/integration/students.test.js`

| Caso | Espera |
|---|---|
| payload válido | `201`, corpo com id, cpf normalizado (11 díg.), email lowercase |
| falta campo / string vazia / renda negativa / renda 3 casas / data futura / email sem formato | `400 VALIDATION_ERROR` + `details` |
| CPF repetido (com pontuação diferente) | `409 DUPLICATE_CPF` |
| email repetido (` Maria@EX.com ` vs `maria@ex.com`) | `409 DUPLICATE_EMAIL` |
| `GET /students` | `200`, lista |

### `tests/integration/enrollments.test.js`

| Caso | Setup | Espera |
|---|---|---|
| confirmada | curso com vaga | `201` `status: CONFIRMADA`, `vagasOcupadas 0→1`, snapshot de bolsa no corpo |
| fila | curso `capacidade 1`, `vagasOcupadas 1` | `201` `status: FILA_ESPERA`, `vagasOcupadas` inalterado |
| idade insuficiente | `birthdateForAge(idadeMinima, 1)` | `422 MINIMUM_AGE_NOT_MET` |
| curso encerrado | curso `status: ENCERRADO` | `422 COURSE_NOT_OPEN` |
| aluno inexistente | ObjectId válido aleatório | `404 STUDENT_NOT_FOUND` |
| curso inexistente | idem | `404 COURSE_NOT_FOUND` |
| ObjectId malformado (`"abc"`) | — | `400 INVALID_OBJECT_ID` |
| duplicada ativa | matrícula `CONFIRMADA` já existe p/ (aluno, curso) | `409 DUPLICATE_ACTIVE_ENROLLMENT` |
| nova após cancelamento | matrícula `CANCELADA` p/ (aluno, curso) | `201` |
| snapshot congelado (INV-7) | criar, alterar `valorMensalidade` do curso | `GET` da matrícula mantém `mensalidadeFinal` antigo |

### `tests/integration/cancel.test.js`

| Caso | Setup | Espera |
|---|---|---|
| confirmada + fila → promove | 1 `CONFIRMADA` + 2 `FILA_ESPERA` (t1<t2) | `200`; a de t1 vira `CONFIRMADA` (INV-6); `vagasOcupadas` **inalterado** |
| confirmada sem fila | só 1 `CONFIRMADA` | `200`; `vagasOcupadas -= 1` |
| cancelar `FILA_ESPERA` | 1 `CONFIRMADA` + 1 `FILA_ESPERA`; cancela a da fila | `200`; `vagasOcupadas` inalterado; a `CONFIRMADA` intocada |
| já cancelada | matrícula `CANCELADA` | `200` estado atual; nenhum efeito (contador/fila iguais) |
| id inexistente | ObjectId aleatório | `404 ENROLLMENT_NOT_FOUND` |
| id malformado | `"xyz"` | `400 INVALID_OBJECT_ID` |

### `tests/integration/enrollments.filters.test.js`

Seed: matrículas variadas. `GET /enrollments?...`:

- `?cursoId=` → só do curso; `?alunoId=` → só do aluno; `?status=CONFIRMADA` → só confirmadas;
- combinação `?cursoId=&status=FILA_ESPERA`;
- `?status=BANANA` → `400`;
- sem filtro → todas, ordenadas por `createdAt` asc.

### `tests/integration/concurrency.test.js`

**Capacidade (INV-4)** — parametrizado:

```js
it.each([[1, 2], [3, 8]])('capacidade %i com %i requisições simultâneas', async (cap, n) => {
  const curso = await makeCourse({ capacidadeVagas: cap, vagasOcupadas: 0 });
  const alunos = await Promise.all(Array.from({ length: n }, () => makeStudent({ dataNascimento: '1990-01-01' })));

  const res = await Promise.all(alunos.map(a =>
    request(app).post('/enrollments').send({ alunoId: a.id, cursoId: curso.id })));

  const confirmadas = res.filter(r => r.body.status === 'CONFIRMADA').length;
  const fila        = res.filter(r => r.body.status === 'FILA_ESPERA').length;
  expect(confirmadas).toBe(cap);
  expect(fila).toBe(n - cap);

  const atual = await Course.findById(curso.id);
  expect(atual.vagasOcupadas).toBe(cap);
  expect(await Enrollment.countDocuments({ cursoId: curso.id, status: 'CONFIRMADA' })).toBe(cap);
});
```

**Cancelamento idempotente (INV-5)** — 2 `PATCH .../cancel` simultâneos na mesma matrícula `CONFIRMADA` (com 1 na fila):

```js
const res = await Promise.all([
  request(app).patch(`/enrollments/${m.id}/cancel`),
  request(app).patch(`/enrollments/${m.id}/cancel`),
]);
expect(res.map(r => r.status).sort()).toEqual([200, 200]);          // decisão: idempotente
expect(await Enrollment.countDocuments({ cursoId, status: 'CONFIRMADA' })).toBe(1); // 1 promoção só
const curso = await Course.findById(cursoId);
expect(curso.vagasOcupadas).toBe(1);                                // 1 decremento no máximo (aqui 0, pois promoveu)
```

**Matrícula duplicada concorrente** — 2 `POST /enrollments` idênticos (mesmo aluno+curso) em paralelo → um `201`, outro `409`.

## Convenções

- **Testar comportamento observável**, não implementação: asserção em status/corpo HTTP + estado final do banco. Nunca espiar chamadas internas de repo/service.
- Não depender de ordem de retorno em cenários concorrentes → ordenar/contar antes de comparar.
- Cada teste monta seu próprio estado; `afterEach` limpa tudo. Zero dependência entre testes.
- IDs e CPFs aleatórios nas factories evitam colisão de índice único entre casos.
- `npm run test:coverage` — sem meta rígida; alvo prático: `domain/` e `services/` perto de 100%, controllers/rotas cobertos pelos testes de integração.

## Ordem de escrita (segue as fases de [04-tasks.md](04-tasks.md))

`scholarship` → `age` → `students` → `enrollments` → `cancel` → `filters` → `concurrency`. Cada arquivo entra junto com a task da feature correspondente, não depois de tudo pronto.
