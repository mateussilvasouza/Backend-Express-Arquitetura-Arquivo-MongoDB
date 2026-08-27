const Enrollment = require('../models/Enrollment');

const { ACTIVE_STATUS } = Enrollment;

function create(data) {
  return Enrollment.create(data);
}

function findById(id) {
  return Enrollment.findById(id);
}

async function existsActive(alunoId, cursoId) {
  const found = await Enrollment.exists({
    alunoId,
    cursoId,
    status: { $in: ACTIVE_STATUS },
  });
  return Boolean(found);
}

function list(filter = {}) {
  return Enrollment.find(filter).sort({ createdAt: 1, _id: 1 });
}

/**
 * Porta única do cancelamento: só o request que efetiva a transição
 * ativa -> CANCELADA recebe o documento (estado anterior). Repetições/concorrência
 * recebem null e não produzem efeito. `new: false` devolve o doc antes do update.
 * @returns {Promise<Enrollment|null>}
 */
function cancelIfActive(id) {
  return Enrollment.findOneAndUpdate(
    { _id: id, status: { $in: ACTIVE_STATUS } },
    { $set: { status: 'CANCELADA', canceladaEm: new Date() } },
    { new: false }
  );
}

/**
 * Promove a primeira matrícula em espera do curso (createdAt asc, _id asc).
 * O filtro `status: FILA_ESPERA` garante que dois cancelamentos concorrentes
 * nunca promovam a mesma pessoa.
 * @returns {Promise<Enrollment|null>} matrícula promovida, ou null se a fila está vazia
 */
function promoteFirstInQueue(cursoId) {
  return Enrollment.findOneAndUpdate(
    { cursoId, status: 'FILA_ESPERA' },
    { $set: { status: 'CONFIRMADA', promovidaEm: new Date() } },
    { sort: { createdAt: 1, _id: 1 }, new: true }
  );
}

module.exports = {
  create,
  findById,
  existsActive,
  list,
  cancelIfActive,
  promoteFirstInQueue,
};
