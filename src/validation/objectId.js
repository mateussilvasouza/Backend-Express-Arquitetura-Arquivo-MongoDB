const mongoose = require('mongoose');
const AppError = require('../errors/AppError');

/** Lança 400 INVALID_OBJECT_ID quando `value` não é um ObjectId válido. */
function assertObjectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw AppError.badRequest('INVALID_OBJECT_ID', `${field} não é um ObjectId válido`);
  }
}

module.exports = { assertObjectId };
