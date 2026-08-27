/**
 * Idade em anos completos numa data civil, calculada por ano/mês/dia (componentes UTC).
 * No dia do aniversário a pessoa já possui a idade nova.
 *
 * @param {string} dataNascimento data civil no formato 'YYYY-MM-DD'
 * @param {Date}   hoje           data de referência (default: agora)
 * @returns {number}
 */
function ageOn(dataNascimento, hoje = new Date()) {
  const [ano, mes, dia] = dataNascimento.split('-').map(Number);

  const hAno = hoje.getUTCFullYear();
  const hMes = hoje.getUTCMonth() + 1;
  const hDia = hoje.getUTCDate();

  let anos = hAno - ano;
  if (hMes < mes || (hMes === mes && hDia < dia)) {
    anos -= 1;
  }
  return anos;
}

module.exports = { ageOn };
