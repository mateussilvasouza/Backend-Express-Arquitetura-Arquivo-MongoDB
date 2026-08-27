/**
 * Valida/normaliza `req[source]` com um schema zod.
 * Em falha, encaminha o ZodError ao errorHandler (-> 400 VALIDATION_ERROR).
 * Em sucesso, substitui `req[source]` pelos dados já coeridos.
 */
module.exports = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error);
  req[source] = result.data;
  return next();
};
