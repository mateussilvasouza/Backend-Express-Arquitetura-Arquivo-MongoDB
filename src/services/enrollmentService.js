const AppError = require('../errors/AppError');
const { assertObjectId } = require('../validation/objectId');
const { scholarship } = require('../domain/scholarship');
const { ageOn } = require('../domain/age');
const studentRepository = require('../repositories/studentRepository');
const courseRepository = require('../repositories/courseRepository');
const enrollmentRepository = require('../repositories/enrollmentRepository');

const duplicateActive = () =>
  AppError.conflict(
    'DUPLICATE_ACTIVE_ENROLLMENT',
    'aluno já possui matrícula ativa neste curso'
  );

async function create({ alunoId, cursoId }) {
  assertObjectId(alunoId, 'alunoId');
  assertObjectId(cursoId, 'cursoId');

  const aluno = await studentRepository.findById(alunoId);
  if (!aluno) throw AppError.notFound('STUDENT_NOT_FOUND', 'aluno não encontrado');

  const curso = await courseRepository.findById(cursoId);
  if (!curso) throw AppError.notFound('COURSE_NOT_FOUND', 'curso não encontrado');

  if (curso.status !== 'ABERTO') {
    throw AppError.unprocessable('COURSE_NOT_OPEN', 'curso não está aberto para matrícula');
  }

  if (ageOn(aluno.dataNascimento) < curso.idadeMinima) {
    throw AppError.unprocessable(
      'MINIMUM_AGE_NOT_MET',
      'aluno não possui a idade mínima exigida pelo curso'
    );
  }

  if (await enrollmentRepository.existsActive(alunoId, cursoId)) {
    throw duplicateActive();
  }

  const { percentualBolsa, mensalidadeFinal } = scholarship(
    aluno.rendaFamiliar,
    curso.valorMensalidade
  );

  // Alocação atômica: vaga garantida -> CONFIRMADA; sem vaga -> FILA_ESPERA.
  const seat = await courseRepository.claimSeat(cursoId);
  const status = seat ? 'CONFIRMADA' : 'FILA_ESPERA';

  try {
    return await enrollmentRepository.create({
      alunoId,
      cursoId,
      status,
      percentualBolsa,
      valorMensalidadeOriginal: curso.valorMensalidade,
      mensalidadeFinal,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      // corrida com outra matrícula do mesmo aluno: desfaz o incremento e responde 409
      if (seat) await courseRepository.releaseSeat(cursoId);
      throw duplicateActive();
    }
    throw err;
  }
}

async function cancel(id) {
  assertObjectId(id, 'id');

  const previous = await enrollmentRepository.cancelIfActive(id);

  if (!previous) {
    const current = await enrollmentRepository.findById(id);
    if (!current) throw AppError.notFound('ENROLLMENT_NOT_FOUND', 'matrícula não encontrada');
    // já CANCELADA -> devolve o estado atual, sem novos efeitos
    return current;
  }

  if (previous.status === 'CONFIRMADA') {
    const promoted = await enrollmentRepository.promoteFirstInQueue(previous.cursoId);
    if (!promoted) {
      // ninguém na fila: a vaga é devolvida ao curso (exatamente uma vez)
      await courseRepository.releaseSeat(previous.cursoId);
    }
  }

  return enrollmentRepository.findById(id);
}

async function list(filters = {}) {
  const query = {};

  if (filters.cursoId) {
    assertObjectId(filters.cursoId, 'cursoId');
    query.cursoId = filters.cursoId;
  }
  if (filters.alunoId) {
    assertObjectId(filters.alunoId, 'alunoId');
    query.alunoId = filters.alunoId;
  }
  if (filters.status) {
    query.status = filters.status;
  }

  return enrollmentRepository.list(query);
}

module.exports = { create, cancel, list };
