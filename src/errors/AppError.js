/**
 * Erro de domínio com semântica HTTP.
 * Services lançam AppError; o errorHandler traduz para o envelope
 * { error: { code, message, details? } }.
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
    if (Error.captureStackTrace) Error.captureStackTrace(this, AppError);
  }
}

AppError.badRequest = (code, message, details) => new AppError(400, code, message, details);
AppError.notFound = (code, message) => new AppError(404, code, message);
AppError.conflict = (code, message) => new AppError(409, code, message);
AppError.unprocessable = (code, message) => new AppError(422, code, message);

module.exports = AppError;
