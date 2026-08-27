# 01 — Stack e Convenções

## Runtime

- **Node.js** `20.x || 22.x || 24.x` (ver `.nvmrc` → `20`)
- **Express** `^4.19` — servidor HTTP
- **Mongoose** `^8.3` — ODM MongoDB
- **MongoDB** — via Docker Compose (`localhost:27028`), banco `desafio_senior`

## Dependências de aplicação

| Pacote | Uso |
|---|---|
| `express` | roteamento HTTP |
| `cors` | CORS liberado |
| `mongoose` | modelos, índices, updates atômicos |
| `dotenv` | carregamento de `.env` (defaults locais existem) |
| `zod` `^4.4` | validação/coerção de payloads na borda |

## Dependências de teste

| Pacote | Uso |
|---|---|
| `jest` `^29` | runner (`--runInBand --detectOpenHandles`) |
| `supertest` `^7` | testes de integração HTTP sobre o `app` |
| `mongodb-memory-server` `^9` | MongoDB efêmero em memória (binário `7.0.14`) |
| `nodemon` | `npm run dev` |

> `mongodb-memory-server` roda **standalone** (sem replica set) → **transações multi-documento não estão disponíveis nos testes**. A estratégia de concorrência não depende de transações (ver [03-plan.md](03-plan.md)).

## Scripts

```bash
npm ci               # instalar
npm run db:up        # subir MongoDB (docker compose --wait)
npm run seed         # popular 3 cursos (idempotente)
npm run dev          # API em http://localhost:3333
npm test             # suíte completa (mongo em memória, não usa docker)
npm run test:watch
npm run test:coverage
npm run db:down
```

## Estrutura de pastas alvo

```
src/
  app.js                     # monta o Express, registra rotas e middlewares (sem listen)
  server.js                  # bootstrap: conecta Mongo -> app.listen
  config/
    database.js              # connect/disconnect Mongoose reutilizável (app + seed + testes)
  models/
    Course.js                # (existe)
    Student.js               # aluno (substitui o Aluno.js do WIP quebrado)
    Enrollment.js            # matrícula (novo)
  repositories/
    studentRepository.js
    courseRepository.js      # inclui os updates atômicos de capacidade
    enrollmentRepository.js
  services/
    studentService.js        # regras de cadastro/normalização/unicidade
    enrollmentService.js     # regras de matrícula, bolsa, idade, fila, cancelamento + repescagem
  controllers/
    studentController.js
    enrollmentController.js
    healthController.js
    courseController.js
  routes/
    index.js                 # Router raiz
    studentRoutes.js
    enrollmentRoutes.js
  validation/
    studentSchema.js         # zod
    enrollmentSchema.js
  domain/
    scholarship.js           # faixas de bolsa (puro, testável isolado)
    age.js                   # cálculo de idade civil (puro)
  errors/
    AppError.js              # erro de domínio com { status, code, message, details }
  middlewares/
    errorHandler.js
    notFound.js
tests/
  unit/
    scholarship.test.js
    age.test.js
  integration/
    students.test.js
    enrollments.test.js
    cancel.test.js
    concurrency.test.js
  helpers/
    mongo.js                 # (existe)
```

## Convenções de código

- CommonJS (`require`/`module.exports`), consistente com o código atual.
- Controllers: só HTTP (parse, status, envelope). Nenhuma regra de negócio.
- Services: regras e invariantes. Não conhecem `req`/`res`. Lançam `AppError`.
- Repositories: única camada que fala Mongoose. Retornam POJOs (`.lean()`) ou docs quando necessário.
- Erros de domínio → `AppError`; o `errorHandler` traduz para o envelope. Erros inesperados → `500` genérico.
- Datas civis (`dataNascimento`) tratadas por componentes `YYYY-MM-DD`, nunca por `Date` local com timezone.
- Valores monetários: número com 2 casas; arredondamento explícito (`Math.round(x*100)/100`).

## Nomenclatura (regra anti-drift)

| Categoria | Idioma | Fonte |
|---|---|---|
| Paths de rota (`/students`, `/enrollments`, `/courses`, `/health`) | **inglês** | tabela de contrato do README |
| Nomes de model / coleção (`Student`, `Enrollment`, `Course`) | **inglês** | `Course` já existe no repo |
| Arquivos, funções, variáveis, `error.code` | **inglês** | consistência interna |
| Campos de payload (`nome`, `cpf`, `email`, `dataNascimento`, `rendaFamiliar`, `alunoId`, `cursoId`) | **português** | payloads do README (contrato externo) |
| Valores de enum (`CONFIRMADA`, `FILA_ESPERA`, `CANCELADA`, `ABERTO`, `ENCERRADO`) | **português** | regras do README |
| Campos do `Course` (`capacidadeVagas`, `vagasOcupadas`, `idadeMinima`, `valorMensalidade`, `codigo`) | **português** | schema já existente |

Regra prática: **o que atravessa o HTTP segue o README; o que é interno é inglês.**
