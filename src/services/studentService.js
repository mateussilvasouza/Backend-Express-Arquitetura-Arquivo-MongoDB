const AppError = require('../errors/AppError');
const studentRepository = require('../repositories/studentRepository');

function duplicateError(key) {
  return key === 'email'
    ? AppError.conflict('DUPLICATE_EMAIL', 'email já cadastrado')
    : AppError.conflict('DUPLICATE_CPF', 'cpf já cadastrado');
}

/**
 * @param {{ nome, cpf, email, dataNascimento, rendaFamiliar }} data já validado/normalizado
 */
async function create(data) {
  if (await studentRepository.findByCpf(data.cpf)) {
    throw duplicateError('cpf');
  }
  if (await studentRepository.findByEmail(data.email)) {
    throw duplicateError('email');
  }

  try {
    return await studentRepository.create(data);
  } catch (err) {
    // corrida entre a checagem acima e o insert: o índice único é a garantia real
    if (err && err.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0];
      throw duplicateError(key);
    }
    throw err;
  }
}

function list() {
  return studentRepository.list();
}

module.exports = { create, list };
