const iso = (date) => date.toISOString().slice(0, 10);

/** 'YYYY-MM-DD' de `n` dias a partir de hoje (UTC); n negativo = passado. */
function daysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/**
 * Data de nascimento ('YYYY-MM-DD') de alguém cujo aniversário de `age` anos
 * cai daqui a `offsetDays` dias.
 *   birthdateForAge(18, 0)  -> faz 18 hoje       (idade hoje: 18)
 *   birthdateForAge(18, 1)  -> faz 18 amanhã     (idade hoje: 17)
 *   birthdateForAge(18, -30)-> fez 18 há 30 dias (idade hoje: 18)
 */
function birthdateForAge(age, offsetDays = 0) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear() - age, now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return iso(d);
}

module.exports = { daysFromNow, birthdateForAge };
