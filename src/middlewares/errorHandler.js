const { ZodError } = require('zod');
const AppError = require('../errors/AppError');

function zodDetails(err) {
  const details = {};
  for (const issue of err.issues) {
    details[issue.path.join('.') || '_'] = issue.message;
  }
  return details;
}

/** Traduz qualquer erro para o envelope { error: { code, message, details? } }. */
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err instanceof AppError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    return res.status(err.status).json(body);
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Payload inválido',
        details: zodDetails(err),
      },
    });
  }

  console.error('Erro não tratado:', err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno no servidor' },
  });
};
