const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    cpf: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // data civil no formato YYYY-MM-DD — String evita ambiguidade de fuso
    dataNascimento: { type: String, required: true },
    rendaFamiliar: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

studentSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);
