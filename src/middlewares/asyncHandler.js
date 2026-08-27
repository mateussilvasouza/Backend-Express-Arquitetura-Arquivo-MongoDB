/**
 * Envolve um handler assíncrono para que rejeições de Promise
 * cheguem ao errorHandler (o Express 4 não captura async por conta própria).
 */
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
