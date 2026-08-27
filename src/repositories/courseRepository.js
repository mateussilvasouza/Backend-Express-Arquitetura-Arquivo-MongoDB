const Course = require('../models/Course');

function findById(id) {
  return Course.findById(id);
}

/**
 * Alocação atômica de uma vaga confirmada.
 * Só incrementa se o curso está ABERTO e ainda há vaga — a condição vive no
 * filtro, então N chamadas concorrentes nunca ultrapassam a capacidade.
 * @returns {Promise<Course|null>} curso atualizado, ou null se não havia vaga
 */
function claimSeat(cursoId) {
  return Course.findOneAndUpdate(
    {
      _id: cursoId,
      status: 'ABERTO',
      $expr: { $lt: ['$vagasOcupadas', '$capacidadeVagas'] },
    },
    { $inc: { vagasOcupadas: 1 } },
    { new: true }
  );
}

/**
 * Libera uma vaga confirmada. A guarda `vagasOcupadas > 0` impede contador negativo
 * e torna a operação segura sob chamadas repetidas.
 */
function releaseSeat(cursoId) {
  return Course.updateOne(
    { _id: cursoId, vagasOcupadas: { $gt: 0 } },
    { $inc: { vagasOcupadas: -1 } }
  );
}

module.exports = { findById, claimSeat, releaseSeat };
