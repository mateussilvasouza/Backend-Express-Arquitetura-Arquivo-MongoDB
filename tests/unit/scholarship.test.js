const { scholarship } = require('../../src/domain/scholarship');

describe('scholarship — faixas de bolsa', () => {
  it.each([
    [0.0, 50, 500],
    [2824.0, 50, 500],
    [2824.01, 20, 800],
    [5648.0, 20, 800],
    [5648.01, 0, 1000],
  ])('renda %p -> %i%% de bolsa, mensalidade final %p (curso 1000)', (renda, pct, final) => {
    expect(scholarship(renda, 1000)).toEqual({
      percentualBolsa: pct,
      mensalidadeFinal: final,
    });
  });

  it('aplica o percentual sobre o valor do curso informado', () => {
    expect(scholarship(2824.0, 450)).toEqual({ percentualBolsa: 50, mensalidadeFinal: 225 });
    expect(scholarship(3000, 600)).toEqual({ percentualBolsa: 20, mensalidadeFinal: 480 });
    expect(scholarship(9999.99, 1200)).toEqual({ percentualBolsa: 0, mensalidadeFinal: 1200 });
  });

  it('não muda de faixa por ruído de ponto flutuante na fronteira', () => {
    expect(scholarship(2824.0, 1000).percentualBolsa).toBe(50);
    expect(scholarship(2824.01, 1000).percentualBolsa).toBe(20);
    expect(scholarship(5648.0, 1000).percentualBolsa).toBe(20);
    expect(scholarship(5648.01, 1000).percentualBolsa).toBe(0);
  });
});
