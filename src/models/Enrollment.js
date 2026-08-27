const mongoose = require('mongoose');

const STATUS = ['CONFIRMADA', 'FILA_ESPERA', 'CANCELADA'];
const ACTIVE_STATUS = ['CONFIRMADA', 'FILA_ESPERA'];

const enrollmentSchema = new mongoose.Schema(
  {
    alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    status: { type: String, enum: STATUS, required: true },

    // snapshot congelado no momento da matrícula
    percentualBolsa: { type: Number, required: true },
    valorMensalidadeOriginal: { type: Number, required: true },
    mensalidadeFinal: { type: Number, required: true },

    canceladaEm: { type: Date, default: null },
    promovidaEm: { type: Date, default: null },
  },
  { timestamps: true }
);

// INV-3: no máximo uma matrícula ativa por (aluno, curso). Cancelada fica de fora.
enrollmentSchema.index(
  { alunoId: 1, cursoId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ACTIVE_STATUS } },
    name: 'uniq_active_enrollment',
  }
);

// Busca da fila para promoção (ordem createdAt asc, desempate _id asc).
enrollmentSchema.index({ cursoId: 1, status: 1, createdAt: 1, _id: 1 });

enrollmentSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    ret.alunoId = ret.alunoId.toString();
    ret.cursoId = ret.cursoId.toString();
    return ret;
  },
});

module.exports =
  mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);
module.exports.STATUS = STATUS;
module.exports.ACTIVE_STATUS = ACTIVE_STATUS;
