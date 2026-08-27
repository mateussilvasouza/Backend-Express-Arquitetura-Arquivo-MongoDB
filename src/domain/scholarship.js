/**
 * Faixa de bolsa a partir da renda familiar e valor do curso.
 * Comparação em centavos para não depender de precisão de ponto flutuante nas fronteiras.
 *
 *   renda até           2824.00  -> 50% de bolsa
 *   renda 2824.01 até   5648.00  -> 20% de bolsa
 *   renda a partir de   5648.01  ->  0% de bolsa
 *
 * @param {number} rendaFamiliar   >= 0, no máximo 2 casas decimais
 * @param {number} valorMensalidade valor cheio da mensalidade do curso
 * @returns {{ percentualBolsa: number, mensalidadeFinal: number }}
 */
function scholarship(rendaFamiliar, valorMensalidade) {
  const rendaCents = Math.round(rendaFamiliar * 100);

  const percentualBolsa =
    rendaCents <= 282400 ? 50 : rendaCents <= 564800 ? 20 : 0;

  const mensalidadeFinal =
    Math.round(valorMensalidade * (100 - percentualBolsa)) / 100;

  return { percentualBolsa, mensalidadeFinal };
}

module.exports = { scholarship };
