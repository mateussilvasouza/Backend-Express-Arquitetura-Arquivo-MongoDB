# 04 — Backlog

Status: `TODO` · `WIP` · `DONE` · `BLOCKED`

## Fase 0 — Baseline verde

| ID | Status | Task | Aceite |
|---|---|---|---|
| T0.1 | DONE | Restaurar `src/app.js` para estado que carrega (remover `app.route/app.user`, `createAlunoController`, imports mortos) | `node -e "require('./src/app')"` sem erro |
| T0.2 | DONE | Confirmar `npm test` verde com a suíte atual (`health.test.js`) | 3 testes passando |
| T0.3 | DONE | Branch `feat/matriculas-bolsas`; commit `adb16c5` com `specs/` + zod (`Aluno.js` do WIP removido) | working tree limpo ou stage coerente |

## Fase 1 — Fundação

| ID | Status | Task | Aceite |
|---|---|---|---|
| T1.1 | DONE | `src/errors/AppError.js` (`status`, `code`, `message`, `details`) | instanciável; `instanceof Error` |
| T1.2 | DONE | `src/middlewares/errorHandler.js` + `notFound.js` + `asyncHandler.js` (envelope, trata `ZodError`) | 404 e 500 saem no envelope novo |
| T1.3 | DONE | `src/config/database.js` (`connect`/`disconnect`); `server.js`/`seed.js` refatorados | `node -c` OK; API do connect correta |
| T1.4 | DONE | `src/routes/index.js` Router raiz; `app.js` monta `routes` + `notFound` + `errorHandler` + `disable('x-powered-by')` | rotas atuais respondendo |
| T1.5 | DONE | `/health` e `/courses` movidos para `controllers/` + `routes/` | `npm test` 3/3 verde |

## Fase 2 — Domínio puro + testes unitários

| ID | Status | Task | Aceite |
|---|---|---|---|
| T2.1 | DONE | `src/domain/scholarship.js` (export `scholarship`, comparação em centavos) | — |
| T2.2 | DONE | `tests/unit/scholarship.test.js` — fronteiras `0`, `2824.00`, `2824.01`, `5648.00`, `5648.01` | verde |
| T2.3 | DONE | `src/domain/age.js` (export `ageOn`, componentes UTC) | — |
| T2.4 | DONE | `tests/unit/age.test.js` — véspera / dia / pós aniversário; 29/02; UTC | verde |

## Fase 3 — Students

| ID | Status | Task | Aceite |
|---|---|---|---|
| T3.1 | DONE | `src/models/Student.js` (coleção `students`; email `required`+`unique`, renda `min:0`, `dataNascimento` String, `toJSON` com `id`); `Aluno.js` do WIP removido | índices via `syncIndexes` no teste |
| T3.2 | DONE | `src/validation/studentSchema.js` (zod v4): obrigatórios, sem string vazia, CPF→11 dígitos, email `z.email` + trim + lower, data `YYYY-MM-DD` válida e não-futura, renda `>=0` com ≤2 casas (checagem em centavos) | schema rejeita casos inválidos |
| T3.3 | DONE | `repositories/studentRepository.js` (`create`, `findById`, `findByCpf`, `findByEmail`, `list`) | — |
| T3.4 | DONE | `services/studentService.js` (checa unicidade → `AppError` 409, fallback `E11000` por `keyPattern`) | — |
| T3.5 | DONE | `controllers/studentController.js` + `routes/studentRoutes.js` + `middlewares/validate.js`; montado em `routes/index.js` | — |
| T3.6 | DONE | `tests/integration/students.test.js` + helpers (`factories`, `dates`, `assertions`, `mongo.syncIndexes`) — 201 normalizado; 9 casos 400; CPF dup 409; email dup 409; `GET` 200 | verde (29/29) |

## Fase 4 — Matrículas

| ID | Status | Task | Aceite |
|---|---|---|---|
| T4.1 | DONE | `src/models/Enrollment.js` — schema, enum, snapshot, índice único parcial, índice de fila | `Enrollment.init()` cria índices |
| T4.2 | DONE | `repositories/enrollmentRepository.js` — `create`, `findById`, `existsActive`, `list(filtros)`, `cancelIfActive`, `promoteFirstInQueue` | — |
| T4.3 | DONE | `repositories/courseRepository.js` — `findById`, `claimSeat`, `releaseSeat` (updates atômicos do [03-plan.md](03-plan.md)) | — |
| T4.4 | DONE | `validation/enrollmentSchema.js` — body (`alunoId`,`cursoId`) + query (`cursoId`,`alunoId`,`status`) | ObjectId malformado → 400 |
| T4.5 | DONE | `services/enrollmentService.js` — sequência de 10 passos do plano (400/404/422/409, bolsa, claimSeat, compensação) | — |
| T4.6 | DONE | `controllers/enrollmentController.js` + `routes/enrollmentRoutes.js` — `POST /enrollments` 201, `GET /enrollments` 200 | — |
| T4.7 | DONE | `tests/integration/enrollments.test.js` — confirmada; fila; 422 idade; 422 curso encerrado; 404 aluno/curso; 400 objectid; 409 duplicada; matrícula pós-cancelamento | verde |

## Fase 5 — Cancelamento e repescagem

| ID | Status | Task | Aceite |
|---|---|---|---|
| T5.1 | DONE | `services/enrollmentService.js#cancel` — sequência do plano (porta única `cancelIfActive`, promoção FIFO, `releaseSeat`) | — |
| T5.2 | DONE | `PATCH /enrollments/:id/cancel` no controller/route — 200/400/404 | — |
| T5.3 | DONE | `tests/integration/cancel.test.js` — confirmada+fila→promove e `vagasOcupadas` estável; confirmada sem fila→`-1`; fila→sem efeito; já cancelada→200 sem efeito; 404 | verde |

## Fase 6 — Concorrência (diferencial)

| ID | Status | Task | Aceite |
|---|---|---|---|
| T6.1 | DONE | `tests/integration/concurrency.test.js` — 1 vaga + 2 `POST` simultâneos → 1 `CONFIRMADA` / 1 `FILA_ESPERA` / contador == capacidade (INV-4) | verde |
| T6.2 | DONE | mesmo arquivo — 2 `cancel` simultâneos na mesma confirmada → 1 decremento / 1 promoção (INV-5) | verde |

## Fase 7 — Documentação

| ID | Status | Task | Aceite |
|---|---|---|---|
| T7.1 | DONE | Seção "Decisões" no `README.md`: (1) responsabilidades e por quê; (2) proteção de capacidade concorrente; (3) prevenção de duplicidade ativa; (4) limitações/trade-offs; (5) o que faria diferente em produção | seção presente, referencia `specs/` |
| T7.2 | DONE | Nota no README sobre a decisão do `cancel` idempotente (`200` em já cancelada) | presente |

## Fase 8 — CI

| ID | Status | Task | Aceite |
|---|---|---|---|
| T8.1 | DONE | `.github/workflows/ci.yml` — `push`/`pull_request`, matriz Node `20/22/24` em `ubuntu-22.04`, `npm ci` + `npm run test:coverage`, cache de npm e do binário do `mongodb-memory-server`, artefato de cobertura | YAML válido; sem dependência de serviço de banco |
| T8.2 | DONE | README: seção "Integração contínua" + badge de status no topo | presente |

## Rastreio de invariantes → testes

| Invariante | Coberta por |
|---|---|
| INV-1 / INV-2 | T4.7, T5.3, T6.1 |
| INV-3 | T4.7 (409 duplicada), T6.1 |
| INV-4 | T6.1 |
| INV-5 | T6.2 |
| INV-6 | T5.3 (promoção FIFO) |
| INV-7 | T4.7 (snapshot no corpo da resposta) |
| INV-8 | T2.4 |

## Ordem de execução sugerida

`Fase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`. Fases 2 e 3 são paralelizáveis. Não avançar de fase com a suíte vermelha.
