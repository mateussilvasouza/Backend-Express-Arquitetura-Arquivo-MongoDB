# SDD — Spec Driven Development

Documentação que guia a implementação do desafio. Ordem de leitura:

| # | Documento | Conteúdo |
|---|---|---|
| 1 | [01-stack.md](01-stack.md) | Stack, dependências, convenções, estrutura de pastas |
| 2 | [02-spec.md](02-spec.md) | Especificação funcional: contrato HTTP, regras de negócio, invariantes, matriz de erros |
| 3 | [03-plan.md](03-plan.md) | Plano técnico: arquitetura em camadas, modelo de dados, estratégia de concorrência |
| 4 | [04-tasks.md](04-tasks.md) | Backlog ordenado com critérios de aceite e rastreio |
| 5 | [05-tests.md](05-tests.md) | Estratégia de testes: pirâmide, helpers/factories, tabela de casos por arquivo |

## Decisões-chave (fixadas)

| Tema | Decisão |
|---|---|
| Arquitetura | `route → controller → service → repository → model` |
| Envelope de erro | `{ "error": { "code": string, "message": string, "details"?: object } }` |
| `cancel` em matrícula já `CANCELADA` | Responde `200 OK` com o estado atual, sem novos efeitos (idempotente) |
| Concorrência de capacidade | Update condicional atômico (`findOneAndUpdate` + `$expr`/`$inc`) |
| Matrícula ativa duplicada | Índice único parcial + tratamento de `E11000` → `409` |
| Validação de entrada | `zod` na borda (controller), antes de tocar o domínio |
| Nomenclatura | Identificadores de código em **inglês** (`/students`, `Student`, `Enrollment`, `error.code`); português só nos literais ditados pelo README (campos de payload, enums). Ver [01-stack.md](01-stack.md#nomenclatura-regra-anti-drift) |

## Convenção de status das tasks

`TODO` · `WIP` · `DONE` · `BLOCKED` — mantido em [04-tasks.md](04-tasks.md).
