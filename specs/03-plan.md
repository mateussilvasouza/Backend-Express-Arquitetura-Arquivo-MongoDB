# 03 — Plano Técnico

## Arquitetura em camadas

```
HTTP  ─▶  routes/       roteamento, monta Router, aplica validação
      ─▶  controllers/  traduz req↔domínio, define status e envelope, não decide regra
      ─▶  services/     regras de negócio, invariantes, orquestração; lança AppError
      ─▶  repositories/ único ponto que fala Mongoose (queries + updates atômicos)
      ─▶  models/       schemas + índices
```

Fluxos puros (sem I/O) ficam em `domain/` (`scholarship`, `age`) e são chamados pelos services — testáveis isoladamente.

**Regra de dependência**: uma camada só conhece a de baixo. Controllers não importam models. Services não importam `express`. Repositories não lançam `AppError` (retornam `null`/valor; o service interpreta).

### Por que repository aqui

O README aceita não ter repository. Optamos por mantê-lo porque a lógica de concorrência vira **uma query condicional específica** (`claimSeat`, `promoteFromQueue`, `releaseSeat`) — isolá-la num repositório deixa o service legível e os updates atômicos concentrados e nomeados. Trade-off assumido: +1 camada de indireção para CRUD trivial.

---

## Modelo de dados

### `Student` (`src/models/Student.js`) — coleção `students`

| Campo | Tipo | Regras |
|---|---|---|
| `nome` | String | `required`, `trim` |
| `cpf` | String | `required`, 11 dígitos, `unique` |
| `email` | String | `required`, `lowercase`, `trim`, `unique` |
| `dataNascimento` | String | `required`, formato `YYYY-MM-DD` (armazenado como string para evitar timezone) |
| `rendaFamiliar` | Number | `required`, `min: 0` |
| timestamps | | `createdAt`, `updatedAt` |

Índices: `{ cpf: 1 }` unique, `{ email: 1 }` unique.

> `dataNascimento` como **String** `YYYY-MM-DD`: elimina ambiguidade de fuso. Alternativa (Date em UTC meia-noite) documentada como possível, mas string é mais simples e explícita para "data civil".

### `Enrollment` (`src/models/Enrollment.js`) — novo

| Campo | Tipo | Regras |
|---|---|---|
| `alunoId` | ObjectId ref `Student` | `required` |
| `cursoId` | ObjectId ref `Course` | `required` |
| `status` | String enum | `CONFIRMADA` \| `FILA_ESPERA` \| `CANCELADA` |
| `percentualBolsa` | Number | `0` \| `20` \| `50` (snapshot) |
| `valorMensalidadeOriginal` | Number | snapshot do curso |
| `mensalidadeFinal` | Number | snapshot calculado |
| `canceladaEm` | Date \| null | preenchido no cancel |
| `promovidaEm` | Date \| null | preenchido se veio da fila |
| timestamps | | `createdAt` (chave de ordenação da fila), `updatedAt` |

**Índice único parcial (garante INV-3):**
```js
enrollmentSchema.index(
  { alunoId: 1, cursoId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['CONFIRMADA', 'FILA_ESPERA'] } } }
);
```
`$in` em `partialFilterExpression` é suportado (MongoDB ≥ 3.6). Permite várias `CANCELADA` para o mesmo par e no máximo uma ativa.

**Índice de fila:** `{ cursoId: 1, status: 1, createdAt: 1, _id: 1 }` para a busca de promoção.

### `Course` — sem mudança de schema

Já tem `capacidadeVagas`, `vagasOcupadas`, `status`, `idadeMinima`, `valorMensalidade`.

---

## Estratégia de concorrência

### Princípio

Nunca fazer `ler → decidir em JS → escrever`. Toda transição que protege uma invariante é **um único comando atômico** com a pré-condição no `filter`. O MongoDB garante atomicidade em nível de documento; a corrida vira "quem escreveu primeiro vence, o outro recebe `null` e cai no caminho alternativo".

### `claimSeat(cursoId)` — alocar vaga confirmada

```js
Course.findOneAndUpdate(
  {
    _id: cursoId,
    status: 'ABERTO',
    $expr: { $lt: ['$vagasOcupadas', '$capacidadeVagas'] }
  },
  { $inc: { vagasOcupadas: 1 } },
  { new: true }
);
```
- retorno ≠ `null` → vaga garantida → cria `Enrollment` `CONFIRMADA`;
- retorno `null` → sem vaga (ou curso fechou) → cria `Enrollment` `FILA_ESPERA`.

`N` concorrentes com `K` vagas: o `$inc` serializa no documento; só `K` updates satisfazem `$expr`. **INV-1 e INV-4 garantidos.**

> Compensação: se `claimSeat` teve sucesso mas o `Enrollment.create` seguinte falhar (ex. `E11000` do índice de duplicidade), precisamos **reverter** o incremento: `Course.updateOne({_id}, {$inc:{vagasOcupadas:-1}})`. Ordem escolhida: verificar duplicidade **antes** de `claimSeat` reduz muito a chance; o `try/catch` com compensação cobre a corrida remanescente.

### `POST /enrollments` — sequência

```
1. valida ObjectIds                    -> 400
2. studentRepo.findById                  -> 404 se null
3. courseRepo.findById                  -> 404 se null
4. curso.status !== ABERTO              -> 422
5. ageOn(aluno.dataNascimento, hoje) < curso.idadeMinima -> 422
6. enrollmentRepo.existsActive(aluno, curso) -> 409
7. { percentualBolsa, mensalidadeFinal } = scholarship(aluno.rendaFamiliar, curso.valorMensalidade)
8. seat = courseRepo.claimSeat(cursoId)
9. try:
     enrollmentRepo.create({ status: seat ? CONFIRMADA : FILA_ESPERA, ...snapshot })
   catch E11000:
     if (seat) courseRepo.releaseSeat(cursoId)   // compensação
     -> 409 DUPLICATE_ACTIVE_ENROLLMENT
10. 201
```

### `PATCH /enrollments/:id/cancel` — sequência

```
1. valida ObjectId                      -> 400
2. prev = enrollmentRepo.cancelIfActive(id)
     // findOneAndUpdate({_id, status: {$in:[CONFIRMADA,FILA_ESPERA]}},
     //                   {$set:{status:CANCELADA, canceladaEm:now}}, {new:false})
3. se prev == null:
     doc = enrollmentRepo.findById(id)
     se doc == null            -> 404
     se doc.status CANCELADA   -> 200 (estado atual, sem efeito)   [decisão fixada]
4. se prev.status == FILA_ESPERA:
     -> 200 (nenhum efeito colateral)
5. se prev.status == CONFIRMADA:
     promoted = enrollmentRepo.promoteFirstInQueue(cursoId)
       // findOneAndUpdate({cursoId, status:FILA_ESPERA},
       //   {$set:{status:CONFIRMADA, promovidaEm:now}},
       //   {sort:{createdAt:1,_id:1}, new:true})
     se promoted     -> vagasOcupadas inalterado
     se !promoted    -> courseRepo.releaseSeat(cursoId)
                        // updateOne({_id, vagasOcupadas:{$gt:0}}, {$inc:{vagasOcupadas:-1}})
     -> 200
```

**Por que é seguro sob concorrência (INV-5):**
- o passo 2 é a **porta única**: só o request que efetiva a transição `ativa → CANCELADA` recebe `prev != null`. Chamadas repetidas/simultâneas recebem `null` e não produzem efeito.
- a promoção (passo 5) usa `findOneAndUpdate` com `status: FILA_ESPERA` no filtro → dois cancels de matrículas confirmadas diferentes nunca promovem a mesma pessoa (o segundo pega o próximo da fila ou `null`).
- `releaseSeat` tem `vagasOcupadas: {$gt: 0}` no filtro → nunca fica negativo.

### Limitações conhecidas (documentar no README)

1. **Sem transação** entre `claimSeat`+`create` e entre `cancelIfActive`+`promote/release`. Uma queda de processo entre os dois passos pode deixar `vagasOcupadas` divergente de INV-2. Mitigação: passos idempotentes + compensação; produção usaria transação (replica set) ou um job de reconciliação.
2. **`existsActive` + índice**: a checagem de leitura é best-effort; a garantia real é o índice único parcial. O custo é uma exceção `E11000` traduzida.
3. **`mongodb-memory-server` é standalone** → não dá para exercitar transações nos testes mesmo que fossem adicionadas.
4. Promoção da fila não notifica ninguém (fora de escopo).
5. Concorrência testada via `Promise.all` no mesmo processo/conexão — aproxima, não reproduz, concorrência distribuída real.

---

## `domain/scholarship.js`

```js
// entrada: rendaFamiliar (>=0, 2 casas), valorMensalidade
// saída:   { percentualBolsa, mensalidadeFinal }
function scholarship(renda, valorMensalidade) {
  const pct = renda <= 2824.00 ? 50 : renda <= 5648.00 ? 20 : 0;
  const mensalidadeFinal = Math.round(valorMensalidade * (100 - pct)) / 100;
  return { percentualBolsa: pct, mensalidadeFinal };
}
```
Comparação em número; para evitar ruído de ponto flutuante nas fronteiras, comparar em centavos (`Math.round(renda*100)`).

## `domain/age.js`

```js
// nascimento: 'YYYY-MM-DD'; hoje: Date (default new Date())
// usa componentes UTC de hoje
function ageOn(nascimento, hoje = new Date()) {
  const [ay, am, ad] = nascimento.split('-').map(Number);
  const hy = hoje.getUTCFullYear(), hm = hoje.getUTCMonth() + 1, hd = hoje.getUTCDate();
  let years = hy - ay;
  if (hm < am || (hm === am && hd < ad)) years--;
  return years;
}
```
No dia do aniversário (`hm===am && hd===ad`) não decrementa → aluno já tem a nova idade (INV-8).

---

## Middlewares

- `notFound`: rota não casada → `404 { error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } }`.
- `errorHandler(err, req, res, next)`: se `err instanceof AppError` → `err.status` + envelope; senão log + `500 INTERNAL_ERROR`. Trata `ZodError` → `400 VALIDATION_ERROR` com `details`.

## `config/database.js`

`connect(uri)` / `disconnect()` reutilizável, usado por `server.js` e `seed.js` (testes continuam com `helpers/mongo.js`).

## `/health`

Mantém a lógica atual (`mongoose.connection.readyState === 1` → `200`, senão `503`). Ajustar o corpo para o envelope só se for erro; sucesso continua com `status/uptime/timestamp/database`.
