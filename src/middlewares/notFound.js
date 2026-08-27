/** Rota não casada -> 404 no envelope padrão. */
module.exports = (req, res) => {
  return res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Rota não encontrada' },
  });
};
