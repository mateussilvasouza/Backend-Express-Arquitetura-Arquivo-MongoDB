const { z } = require('zod');

function isValidCivilDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function isNotFuture(value) {
  const today = new Date().toISOString().slice(0, 10); // hoje em UTC, YYYY-MM-DD
  return value <= today; // comparação lexicográfica é válida para datas ISO
}

function hasAtMostTwoDecimals(value) {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

const nome = z
  .string({ error: 'nome é obrigatório' })
  .trim()
  .min(1, 'nome não pode ser vazio');

const cpf = z
  .string({ error: 'cpf é obrigatório' })
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11, 'cpf deve conter exatamente 11 dígitos');

const email = z
  .string({ error: 'email é obrigatório' })
  .trim()
  .toLowerCase()
  .pipe(z.email('email inválido'));

const dataNascimento = z
  .string({ error: 'dataNascimento é obrigatória' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dataNascimento deve estar no formato YYYY-MM-DD')
  .refine(isValidCivilDate, 'dataNascimento não é uma data válida')
  .refine(isNotFuture, 'dataNascimento não pode estar no futuro');

const rendaFamiliar = z
  .number({ error: 'rendaFamiliar é obrigatória' })
  .min(0, 'rendaFamiliar deve ser maior ou igual a zero')
  .refine(hasAtMostTwoDecimals, 'rendaFamiliar deve ter no máximo duas casas decimais');

const createStudentSchema = z.object({
  nome,
  cpf,
  email,
  dataNascimento,
  rendaFamiliar,
});

module.exports = { createStudentSchema };
