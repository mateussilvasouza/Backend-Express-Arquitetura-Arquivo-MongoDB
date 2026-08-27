# Desafio Técnico — Backend Sênior II

API de gestão de matrículas e bolsas educacionais utilizando Node.js, Express e MongoDB.

<!-- Ajuste o slug do repositório se o remote mudar. -->
[![CI](https://github.com/mateussilvasouza/Backend-Express-Arquitetura-Arquivo-MongoDB/actions/workflows/ci.yml/badge.svg)](https://github.com/mateussilvasouza/Backend-Express-Arquitetura-Arquivo-MongoDB/actions/workflows/ci.yml)

> **Nota da entrega:** a pasta [`specs/`](specs/) faz parte da solução e foi mantida no repositório
> de propósito — ela mostra o método de trabalho (Spec Driven Development assistido por IA) usado
> antes de escrever código. Ver [Método de trabalho](#método-de-trabalho-sdd-assistido-por-ia).

## Objetivo

Este desafio avalia principalmente como você:

- explora e entende um projeto existente;
- transforma requisitos em regras e invariantes;
- organiza responsabilidades de forma proporcional;
- utiliza Express, HTTP e MongoDB;
- identifica riscos de concorrência e consistência;
- escreve e revisa testes;
- explica decisões e trade-offs.

O objetivo não é medir velocidade de digitação, quantidade de arquivos ou conhecimento decorado de padrões arquiteturais.

## Live coding (aproximadamente 40 minutos)

Você poderá consultar internet e documentação, mas não utilizar IA para gerar a solução.

Não existe expectativa de concluir todo o desafio nessa etapa. Faça o que considerar mais relevante no tempo disponível. Concluir todo o escopo não é critério de aprovação.

O ambiente, as dependências, o banco, o seed e os testes iniciais devem ser validados antes de iniciar a contagem dos 40 minutos. Problemas de instalação ou infraestrutura não fazem parte da avaliação e não devem consumir o tempo do candidato.

Durante o live coding, valorizamos:

- entendimento e priorização;
- comunicação do raciocínio;
- fundamentos de backend;
- identificação de riscos e edge cases;
- qualidade das decisões, mesmo que ainda não estejam implementadas.

Escrever menos código com raciocínio correto pode demonstrar mais senioridade do que concluir rapidamente com regras incorretas.

## O que já está pronto

- aplicação Express com JSON e CORS configurados;
- conexão com MongoDB separada da instância Express;
- model de curso;
- Docker Compose com MongoDB;
- seed idempotente com três cursos;
- `GET /health` e `GET /courses`;
- resposta 404 e middleware básico de erros;
- Jest, Supertest e helper de MongoDB em memória;
- testes iniciais de funcionamento.

Você não precisa recriar essa infraestrutura. Pode refatorá-la caso isso ajude sua solução.

## O que deve ser implementado

- cadastro e listagem de alunos;
- matrícula com idade mínima e bolsa;
- controle de capacidade e fila de espera;
- prevenção de matrícula ativa duplicada;
- cancelamento e promoção da fila;
- listagem filtrada de matrículas;
- testes das regras e fluxos principais;
- breve documentação das decisões.

## Contrato HTTP

| Método | Endpoint | Sucesso |
|---|---|---:|
| `GET` | `/health` | `200` quando a API e o banco estão prontos; `503` quando o banco não está disponível |
| `GET` | `/courses` | `200` |
| `POST` | `/students` | `201` |
| `GET` | `/students` | `200` |
| `POST` | `/enrollments` | `201` |
| `GET` | `/enrollments` | `200` |
| `PATCH` | `/enrollments/:id/cancel` | `200` |

Mantenha as respostas de erro em JSON e com formato consistente. O envelope exato fica a seu critério.

## Inicialização

### Pré-requisitos

- Node.js na versão indicada em `.nvmrc`;
- Docker com Docker Compose.

### Comandos

```bash
npm ci
cp .env.example .env  # opcional: a aplicação possui defaults locais
npm run db:up
npm run seed
npm run dev
```

Em outro terminal:

```bash
npm test
```

Comandos úteis:

```bash
npm run test:watch
npm run test:coverage
npm run db:down
```

- API: `http://localhost:3333`
- MongoDB: `mongodb://localhost:27028/desafio_senior`
- Healthcheck: `GET http://localhost:3333/health`
- Cursos: `GET http://localhost:3333/courses`

Os testes utilizam MongoDB em memória e não dependem do Docker. Na primeira instalação, o pacote de testes pode precisar baixar um binário do MongoDB.

## Arquitetura

Organize a aplicação da maneira que considerar adequada para o tamanho do desafio.

Nenhum padrão arquitetural, conjunto de interfaces ou quantidade mínima de camadas é obrigatório. Uma estrutura simples como `route -> controller -> service/use case -> model/repository` é totalmente válida. Também é válido não criar uma camada que você considere overengineering.

Avaliaremos:

- responsabilidades claras;
- regras de negócio localizadas e testáveis;
- acoplamento proporcional;
- legibilidade e facilidade de alteração;
- capacidade de explicar as escolhas.

## Regras de negócio

### 1. Alunos

#### `POST /students`

Payload:

```json
{
  "nome": "Maria Silva",
  "cpf": "123.456.789-00",
  "email": "maria@example.com",
  "dataNascimento": "2000-08-20",
  "rendaFamiliar": 2824.00
}
```

Regras:

- todos os campos são obrigatórios;
- strings vazias não são válidas;
- `dataNascimento` é uma data civil no formato `YYYY-MM-DD` e não pode estar no futuro;
- `rendaFamiliar` deve ser maior ou igual a zero e ter no máximo duas casas decimais;
- normalize o CPF removendo pontuação e exija exatamente 11 dígitos;
- para este desafio, não é necessário implementar o algoritmo oficial dos dígitos verificadores do CPF;
- CPF deve ser único após normalização;
- normalize email com `trim` e comparação case-insensitive;
- email deve possuir formato válido e ser único após normalização.

Retornos esperados:

- `201 Created`: aluno criado;
- `400 Bad Request`: payload inválido;
- `409 Conflict`: CPF ou email duplicado.

#### `GET /students`

Retorna os alunos cadastrados com `200 OK`.

### 2. Matrículas

#### `POST /enrollments`

Payload:

```json
{
  "alunoId": "ID_DO_ALUNO",
  "cursoId": "ID_DO_CURSO"
}
```

Regras gerais:

- aluno e curso devem existir;
- somente cursos com status `ABERTO` aceitam matrícula;
- ObjectId malformado deve retornar `400 Bad Request`;
- recurso inexistente deve retornar `404 Not Found`;
- curso encerrado ou aluno sem idade suficiente deve retornar `422 Unprocessable Entity`;
- um aluno pode ter no máximo uma matrícula ativa (`CONFIRMADA` ou `FILA_ESPERA`) por curso;
- uma nova matrícula após cancelamento é permitida;
- duplicidade ativa deve retornar `409 Conflict`.

#### Idade mínima

A idade deve ser calculada na data da matrícula usando ano, mês e dia do calendário. Não utilize apenas diferença de anos ou divisão da quantidade de dias por 365.

No dia do aniversário, o aluno já possui a nova idade.

#### Bolsa

| Renda familiar | Bolsa | Mensalidade final |
|---|---:|---:|
| até `2824.00` | 50% | 50% do valor do curso |
| de `2824.01` até `5648.00` | 20% | 80% do valor do curso |
| a partir de `5648.01` | 0% | valor integral |

O percentual da bolsa e o valor final da mensalidade devem ser armazenados na matrícula.

#### Capacidade e fila

- se `vagasOcupadas < capacidadeVagas`, crie a matrícula como `CONFIRMADA` e incremente `vagasOcupadas`;
- se o curso estiver lotado, crie como `FILA_ESPERA` sem alterar `vagasOcupadas`;
- `vagasOcupadas` representa somente matrículas confirmadas;
- duas requisições concorrentes não podem fazer `vagasOcupadas` ultrapassar `capacidadeVagas`.

Exemplo: com uma única vaga restante e duas solicitações simultâneas de alunos diferentes, no máximo uma pode terminar `CONFIRMADA`; a outra deve ir para `FILA_ESPERA`, e o contador deve aumentar somente uma vez.

Uma sequência `buscar curso -> verificar vagas -> atualizar curso` pode sofrer race condition. Durante o live coding, perceber e explicar esse risco já é um sinal importante. Na solução, proteja a capacidade com um update condicional atômico ou uma abordagem equivalente.

### 3. Cancelamento e repescagem

#### `PATCH /enrollments/:id/cancel`

- altere a matrícula para `CANCELADA`;
- cancelar uma matrícula em `FILA_ESPERA` não altera `vagasOcupadas` e não promove outra pessoa;
- ao cancelar uma matrícula `CONFIRMADA`, promova a primeira matrícula em espera do mesmo curso;
- a fila deve ser ordenada por `createdAt` crescente e, em caso de empate, `_id` crescente;
- se houver promoção, `vagasOcupadas` permanece igual: uma pessoa saiu e outra ocupou a vaga;
- se não houver fila, decremente `vagasOcupadas` exatamente uma vez;
- chamadas repetidas ou concorrentes não podem repetir decrementos nem promover mais de uma pessoa para a mesma vaga.

Para uma matrícula já cancelada, você pode escolher entre retornar o estado atual com `200 OK` ou retornar `409 Conflict`. Documente a decisão. Em ambos os casos, a operação não pode produzir novos efeitos.

### 4. Listagem de matrículas

#### `GET /enrollments`

Filtros opcionais:

- `cursoId`;
- `alunoId`;
- `status`: `CONFIRMADA`, `FILA_ESPERA` ou `CANCELADA`.

Filtros fazem parte do escopo, mas possuem peso menor que a correção das regras de matrícula, capacidade e cancelamento.

## Concorrência

- reconhecer a race condition da última vaga;
- impedir que a capacidade seja ultrapassada;
- evitar efeitos duplicados no cancelamento;
- explicar como tratou ou trataria duplicidade concorrente;
- documentar limitações relevantes da solução.

Não existe uma abordagem técnica única obrigatória. Escolha uma solução proporcional, explique o que ela garante e reconheça suas limitações.

## Testes

Não existe meta obrigatória de cobertura percentual.

Considere pelo menos os seguintes cenários:

### Unitários

- fronteiras das três faixas de bolsa;
- idade antes, no dia e depois do aniversário;
- regras de transição relevantes, se estiverem isoladas do banco.

### Integração

- cadastro válido e duplicidade de aluno;
- matrícula confirmada;
- matrícula em fila de espera;
- rejeição por idade;
- prevenção de matrícula ativa duplicada;
- cancelamento com promoção;
- cancelamento sem pessoa na fila.

Um teste concorrente provando que a capacidade não é ultrapassada é um diferencial importante.

Durante o live coding, não é esperado escrever essa suíte completa. Um único teste relevante, ou uma boa explicação da estratégia, já fornece sinal.

## Integração contínua

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda a suíte a cada `push` (qualquer branch)
e em cada `pull_request`.

| Item | Detalhe |
|---|---|
| Runner | `ubuntu-22.04` (libssl compatível com o binário do MongoDB 7.0.14) |
| Matriz | Node `20.x`, `22.x`, `24.x` (`fail-fast: false`) — cobre o range de `engines` do `package.json` |
| Passos | `npm ci` → `npm run test:coverage` |
| Cache | dependências npm (`actions/setup-node`) e binário do `mongodb-memory-server` (`~/.cache/mongodb-binaries`) |
| Artefato | relatório de cobertura publicado na leg Node `24.x` |

Os testes usam MongoDB em memória, então o job **não** precisa de serviço de banco nem de Docker.
O badge de status está no topo deste README — atualize o slug do repositório se o remote mudar.

## Critérios de avaliação

### Live coding

Priorizaremos:

1. raciocínio e comunicação;
2. entendimento das regras e invariantes;
3. fundamentos backend/HTTP/MongoDB;
4. identificação de concorrência e inconsistências;
5. organização e qualidade das decisões;
6. estratégia de testes.

A quantidade de código concluída possui peso baixo.

## Documentação das decisões

### Método de trabalho (SDD assistido por IA)

A pasta [`specs/`](specs/) foi versionada de propósito, para deixar visível **como conduzi o trabalho com IA**.
Antes de escrever código, transformei o enunciado em especificação executável e revisei cada documento:

| Documento | Papel |
|---|---|
| [`specs/01-stack.md`](specs/01-stack.md) | stack, convenções, nomenclatura (o que atravessa o HTTP segue o enunciado; o resto é inglês) |
| [`specs/02-spec.md`](specs/02-spec.md) | contrato HTTP, regras por endpoint, **8 invariantes testáveis**, matriz de códigos de erro |
| [`specs/03-plan.md`](specs/03-plan.md) | arquitetura em camadas, modelo de dados, **estratégia de concorrência com pseudocódigo** |
| [`specs/04-tasks.md`](specs/04-tasks.md) | backlog em 7 fases com critério de aceite e rastreio invariante → teste |
| [`specs/05-tests.md`](specs/05-tests.md) | pirâmide de testes, helpers/factories, tabela de casos por arquivo |

Fluxo: **spec → plano → tasks → testes**, decisões ambíguas resolvidas explicitamente antes da implementação
(camadas, envelope de erro, semântica do `cancel` idempotente), e **um commit por fase** — o histórico do
Git mostra a progressão `baseline → fundação → domínio → students → enrollments → cancel → concorrência → docs`.
A IA foi usada para acelerar spec, boilerplate e testes; a revisão de regras, invariantes e trade-offs foi minha.

### 1. Organização das responsabilidades

`route → controller → service → repository → model`, mais dois módulos de apoio:

| Camada | Responsabilidade | Não faz |
|---|---|---|
| `routes/` | montar Router, aplicar `validate(schema)` | regra de negócio |
| `controllers/` | traduzir HTTP ↔ domínio, status e envelope | decisão de regra |
| `services/` | regras, invariantes, orquestração; lança `AppError` | conhecer `req`/`res` |
| `repositories/` | única camada que fala Mongoose (inclui os updates atômicos) | lançar `AppError` |
| `models/` | schema + índices | — |
| `domain/` | `scholarship` e `age` — funções puras, testadas isoladas | I/O |
| `validation/` | schemas zod na borda; `assertObjectId` → `400 INVALID_OBJECT_ID` | — |

Por quê: o desafio é pequeno, mas as regras de concorrência viram queries condicionais específicas
(`claimSeat`, `releaseSeat`, `cancelIfActive`, `promoteFirstInQueue`) — concentrá-las em repositórios
nomeados mantém o service legível e os pontos críticos localizados. Regras puras (bolsa, idade) ficam
fora do banco para teste unitário direto. Erros de domínio passam por `AppError` e um `errorHandler`
único os converte no envelope `{ error: { code, message, details? } }`.

### 2. Proteção da capacidade sob concorrência

Nenhum `ler → decidir em JS → escrever`. A vaga é alocada por **um único update condicional atômico**:

```js
Course.findOneAndUpdate(
  { _id, status: 'ABERTO', $expr: { $lt: ['$vagasOcupadas', '$capacidadeVagas'] } },
  { $inc: { vagasOcupadas: 1 } },
  { new: true }
)
```

O MongoDB serializa escritas no mesmo documento e reavalia o filtro no instante da escrita
(`filter` + `$inc` = compare-and-swap). Com `N` requisições e `K` vagas, apenas `K` updates
satisfazem o `$expr`; os demais recebem `null` e viram `FILA_ESPERA` sem tocar o contador.
`releaseSeat` usa a guarda `vagasOcupadas > 0` para nunca ficar negativo.
Prova: `tests/integration/concurrency.test.js` (capacidade `K`, `N` `POST` simultâneos → exatamente `K` confirmadas).

### 3. Prevenção de matrícula ativa duplicada

Duas defesas; a segunda é a garantia real:

1. leitura `existsActive(alunoId, cursoId)` no service → `409` limpo no caso comum;
2. **índice único parcial** `{ alunoId, cursoId }` com `partialFilterExpression: { status: { $in: ['CONFIRMADA','FILA_ESPERA'] } }`.
   Em corrida, um insert vence e o outro recebe `E11000`, traduzido para `409 DUPLICATE_ACTIVE_ENROLLMENT`
   (com compensação do `claimSeat` já aplicado). `CANCELADA` fica fora do índice → nova matrícula após cancelamento é permitida.

O cancelamento é idempotente pela **porta única** `cancelIfActive` (`findOneAndUpdate` com `status $in` ativos):
só o request que efetiva a transição `ativa → CANCELADA` produz efeito; repetições/concorrência recebem `null`.
A promoção da fila (`findOneAndUpdate` com `status: 'FILA_ESPERA'`, ordem `createdAt` asc / `_id` asc)
garante que dois cancelamentos concorrentes nunca promovam a mesma pessoa.

**Decisão:** `PATCH /enrollments/:id/cancel` numa matrícula **já `CANCELADA`** responde **`200 OK`** com o
estado atual e **sem novos efeitos** (idempotente para retries de cliente).

### 4. Limitações e trade-offs

- **Sem transação multi-documento** entre `claimSeat` + `create` e entre `cancelIfActive` + `promote`/`release`.
  Uma queda de processo entre os passos pode divergir `vagasOcupadas` da contagem de confirmadas.
  Mitigação atual: passos idempotentes + compensação no `E11000`.
- `mongodb-memory-server` roda **standalone** → transações não seriam testáveis mesmo se adicionadas.
- Testes de concorrência usam `Promise.all` no mesmo processo/conexão: **aproximam**, não reproduzem concorrência distribuída.
- Sem `Idempotency-Key`: um retry de `POST /enrollments` que já criou não é deduplicado (a menos que caia na regra de duplicidade ativa).
- CPF sem validação de dígito verificador (fora do escopo do desafio).
- `existsActive` + índice: o custo da corrida é uma exceção `E11000` traduzida.

### 5. O que faria diferente em produção

- Envolver `claimSeat`+`create` e o cancelamento em **transação** (replica set), ou um job de reconciliação `vagasOcupadas` ↔ confirmadas.
- `Idempotency-Key` em `POST /enrollments` e no `cancel`.
- CORS restrito por origem (hoje `cors()` liberado) e `helmet()` com configuração explícita; hoje só `app.disable('x-powered-by')`.
- Rate limiting, limite de corpo em `express.json({ limit })`, logs estruturados e observabilidade.
- Paginação em `GET /students` e `GET /enrollments`.
- Promoção da fila disparando notificação ao aluno.
