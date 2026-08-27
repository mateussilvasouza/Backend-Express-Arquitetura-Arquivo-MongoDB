# 02 — Especificação Funcional

Fonte de verdade das regras: [`README.md`](../README.md) §Regras de negócio. Este documento consolida em contrato + invariantes + matriz de erros testáveis.

## Contrato HTTP

| Método | Endpoint | Sucesso | Erros |
|---|---|---:|---|
| `GET` | `/health` | `200` / `503` | — |
| `GET` | `/courses` | `200` | — |
| `POST` | `/students` | `201` | `400`, `409` |
| `GET` | `/students` | `200` | — |
| `POST` | `/enrollments` | `201` | `400`, `404`, `409`, `422` |
| `GET` | `/enrollments` | `200` | `400` (filtro inválido) |
| `PATCH` | `/enrollments/:id/cancel` | `200` | `400`, `404` |

### Envelope de erro

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "texto legível", "details": { "campo": "motivo" } } }
```

`details` é opcional (presente em erros de validação). `code` é string estável (tabela abaixo).

---

## 1. Alunos

### `POST /students`

**Payload**
```json
{
  "nome": "Maria Silva",
  "cpf": "123.456.789-00",
  "email": "maria@example.com",
  "dataNascimento": "2000-08-20",
  "rendaFamiliar": 2824.00
}
```

**Regras de validação (→ `400 VALIDATION_ERROR`)**
- todos os campos obrigatórios; strings vazias (ou só espaços) são inválidas;
- `nome`: string não vazia após `trim`;
- `cpf`: após remover tudo que não é dígito, precisa ter **exatamente 11 dígitos**. Não validar dígito verificador oficial;
- `email`: `trim` + formato válido; comparação/armazenamento **case-insensitive** (guardar `lowercase`);
- `dataNascimento`: string `YYYY-MM-DD` válida no calendário; **não pode ser futura** (comparada à data civil de hoje, UTC);
- `rendaFamiliar`: número `>= 0`, no máximo **2 casas decimais**.

**Unicidade (→ `409`)**
- `cpf` normalizado duplicado → `409 DUPLICATE_CPF`;
- `email` normalizado duplicado → `409 DUPLICATE_EMAIL`.

**Sucesso**: `201` com o aluno criado (id, campos normalizados, `createdAt`). CPF pode ser devolvido normalizado (11 dígitos).

### `GET /students`
`200` com a lista de alunos cadastrados. Sem paginação obrigatória.

---

## 2. Matrículas

### `POST /enrollments`

**Payload**: `{ "alunoId": "...", "cursoId": "..." }`

**Ordem de verificação** (o primeiro que falhar define a resposta):

| # | Verificação | Falha → |
|---|---|---|
| 1 | `alunoId` e `cursoId` são ObjectId válidos | `400 INVALID_OBJECT_ID` |
| 2 | aluno existe | `404 STUDENT_NOT_FOUND` |
| 3 | curso existe | `404 COURSE_NOT_FOUND` |
| 4 | curso `status === 'ABERTO'` | `422 COURSE_NOT_OPEN` |
| 5 | idade do aluno na data da matrícula `>= curso.idadeMinima` | `422 MINIMUM_AGE_NOT_MET` |
| 6 | aluno não tem matrícula ativa (`CONFIRMADA`/`FILA_ESPERA`) nesse curso | `409 DUPLICATE_ACTIVE_ENROLLMENT` |
| 7 | alocação de vaga (ver invariantes) | — |

- Nova matrícula **após cancelamento** é permitida (só matrículas ativas contam para o passo 6).
- Passo 6 é verificado por leitura **e** garantido por índice único parcial (corrida → captura `E11000` → `409`).

**Cálculo da bolsa** (faixas por `rendaFamiliar`, valores inclusivos):

| Renda familiar | % Bolsa | Mensalidade final |
|---|---:|---:|
| `0.00` … `2824.00` | 50 | `valorMensalidade * 0.50` |
| `2824.01` … `5648.00` | 20 | `valorMensalidade * 0.80` |
| `>= 5648.01` | 0 | `valorMensalidade` |

O `percentualBolsa` e a `mensalidadeFinal` são **congelados na matrícula** no momento da criação (snapshot; mudanças futuras no curso não afetam matrículas existentes).

**Alocação de vaga**
- `vagasOcupadas < capacidadeVagas` → matrícula `CONFIRMADA` + `vagasOcupadas += 1` (atômico);
- curso lotado → matrícula `FILA_ESPERA`, `vagasOcupadas` inalterado.

**Sucesso**: `201` com a matrícula (`status`, `percentualBolsa`, `mensalidadeFinal`, `alunoId`, `cursoId`, `createdAt`).

### `GET /enrollments`

Filtros opcionais via query string, combináveis (AND):
- `cursoId` — ObjectId válido, senão `400`;
- `alunoId` — ObjectId válido, senão `400`;
- `status` ∈ {`CONFIRMADA`, `FILA_ESPERA`, `CANCELADA`}, senão `400`.

`200` com a lista (ordenada por `createdAt` asc). Sem filtro → todas.

---

## 3. Cancelamento e repescagem

### `PATCH /enrollments/:id/cancel`

| # | Verificação | Resultado |
|---|---|---|
| 1 | `:id` é ObjectId válido | senão `400 INVALID_OBJECT_ID` |
| 2 | matrícula existe | senão `404 ENROLLMENT_NOT_FOUND` |
| 3 | matrícula já `CANCELADA` | `200` com estado atual, **sem novos efeitos** (decisão fixada) |
| 4 | transição ativa → `CANCELADA` (atômica, condicionada ao status ativo) | segue abaixo |

**Efeitos colaterais conforme o status anterior:**
- anterior `FILA_ESPERA`: nada. `vagasOcupadas` inalterado, ninguém promovido.
- anterior `CONFIRMADA`:
  - buscar a **primeira** matrícula `FILA_ESPERA` do mesmo curso, ordem `createdAt` asc, desempate `_id` asc, e promovê-la a `CONFIRMADA` (atômico);
  - **se promoveu**: `vagasOcupadas` permanece igual (uma sai, uma entra);
  - **se não há fila**: `vagasOcupadas -= 1` (exatamente uma vez, e nunca abaixo de 0).

**Sucesso**: `200` com a matrícula cancelada.

---

## Invariantes (o que os testes provam)

| ID | Invariante |
|---|---|
| **INV-1** | `0 <= curso.vagasOcupadas <= curso.capacidadeVagas` em todos os momentos |
| **INV-2** | `curso.vagasOcupadas == count(matrículas CONFIRMADA do curso)` |
| **INV-3** | No máximo **uma** matrícula ativa (`CONFIRMADA`\|`FILA_ESPERA`) por `(alunoId, cursoId)` |
| **INV-4** | `N` requisições concorrentes com `K` vagas livres → no máximo `K` viram `CONFIRMADA`; o contador sobe no máximo `K` |
| **INV-5** | `cancel` repetido/concorrente na mesma matrícula: no máximo **um** decremento e no máximo **uma** promoção |
| **INV-6** | Promoção respeita ordem FIFO (`createdAt` asc, `_id` asc) |
| **INV-7** | `percentualBolsa`/`mensalidadeFinal` da matrícula não mudam após a criação |
| **INV-8** | Idade calculada por ano/mês/dia; no dia do aniversário o aluno **já** tem a nova idade |

---

## Matriz de códigos de erro

| `code` | HTTP | Origem |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | payload/query inválidos (zod) |
| `INVALID_OBJECT_ID` | 400 | ObjectId malformado em body/param/query |
| `STUDENT_NOT_FOUND` | 404 | `alunoId` inexistente |
| `COURSE_NOT_FOUND` | 404 | `cursoId` inexistente |
| `ENROLLMENT_NOT_FOUND` | 404 | `:id` inexistente no cancel |
| `COURSE_NOT_OPEN` | 422 | curso não está `ABERTO` |
| `MINIMUM_AGE_NOT_MET` | 422 | idade `<` `idadeMinima` |
| `DUPLICATE_ACTIVE_ENROLLMENT` | 409 | já existe matrícula ativa do aluno no curso |
| `DUPLICATE_CPF` | 409 | CPF normalizado já cadastrado |
| `DUPLICATE_EMAIL` | 409 | email normalizado já cadastrado |
| `INTERNAL_ERROR` | 500 | não tratado |

---

## Cenários de teste (mínimo)

### Unitários (domínio puro)
- `scholarship` (bolsa): fronteiras `2824.00`, `2824.01`, `5648.00`, `5648.01`, `0`.
- `age` (idade): dia anterior ao aniversário, dia do aniversário, dia seguinte; nascido em 29/02.

### Integração
- aluno: cadastro válido `201`; CPF duplicado `409`; email duplicado (case/space diferente) `409`; payload inválido `400`.
- matrícula: `CONFIRMADA` quando há vaga; `FILA_ESPERA` quando lotado; `422` por idade; `422` por curso encerrado; `404` aluno/curso; `400` ObjectId; `409` duplicada ativa; nova matrícula após cancelamento `201`.
- cancel: `CONFIRMADA` com fila → promove primeiro da fila, `vagasOcupadas` estável; `CONFIRMADA` sem fila → `vagasOcupadas -= 1`; `FILA_ESPERA` → sem efeito; já cancelada → `200` sem efeito; `404` inexistente.
- filtros: por `cursoId`, `alunoId`, `status`; combinação.

### Concorrência (diferencial)
- 1 vaga livre + 2 `POST /enrollments` simultâneos → exatamente 1 `CONFIRMADA`, 1 `FILA_ESPERA`, `vagasOcupadas == capacidade` (INV-4).
- 2 `PATCH .../cancel` simultâneos na mesma matrícula `CONFIRMADA` → 1 decremento único / 1 promoção única (INV-5).
