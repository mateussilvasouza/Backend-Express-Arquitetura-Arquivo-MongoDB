const { ageOn } = require('../../src/domain/age');

describe('ageOn — idade civil por ano/mês/dia', () => {
  it('véspera do aniversário: mantém a idade anterior', () => {
    expect(ageOn('2000-06-15', new Date('2018-06-14T00:00:00Z'))).toBe(17);
  });

  it('no dia do aniversário: já possui a idade nova', () => {
    expect(ageOn('2000-06-15', new Date('2018-06-15T00:00:00Z'))).toBe(18);
  });

  it('depois do aniversário', () => {
    expect(ageOn('2000-06-15', new Date('2018-09-01T00:00:00Z'))).toBe(18);
  });

  it('nascido em 29/02: completa idade em 28/02 -> 01/03 nos anos não bissextos', () => {
    expect(ageOn('2004-02-29', new Date('2023-02-28T00:00:00Z'))).toBe(18);
    expect(ageOn('2004-02-29', new Date('2023-03-01T00:00:00Z'))).toBe(19);
  });

  it('usa componentes UTC, não o fuso local', () => {
    expect(ageOn('2000-06-15', new Date('2018-06-15T02:00:00Z'))).toBe(18);
  });

  it('recém-nascido tem 0', () => {
    const hoje = new Date('2026-08-27T12:00:00Z');
    expect(ageOn('2026-08-27', hoje)).toBe(0);
    expect(ageOn('2026-08-26', hoje)).toBe(0);
  });
});
