const { z } = require('zod');
const { STATUS } = require('../models/Enrollment');

const nonEmpty = (field) =>
  z.string({ error: `${field} é obrigatório` }).trim().min(1, `${field} é obrigatório`);

const createEnrollmentSchema = z.object({
  alunoId: nonEmpty('alunoId'),
  cursoId: nonEmpty('cursoId'),
});

const listEnrollmentsSchema = z.object({
  cursoId: z.string().trim().min(1).optional(),
  alunoId: z.string().trim().min(1).optional(),
  status: z.enum(STATUS, { error: 'status inválido' }).optional(),
});

module.exports = { createEnrollmentSchema, listEnrollmentsSchema };
