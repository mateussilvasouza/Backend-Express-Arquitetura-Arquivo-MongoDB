/** Confere o envelope de erro { error: { code, message, details? } }. */
function expectError(res, status, code) {
  expect(res.status).toBe(status);
  expect(res.body).toHaveProperty('error');
  expect(res.body.error).toMatchObject({ code });
  expect(typeof res.body.error.message).toBe('string');
}

module.exports = { expectError };
