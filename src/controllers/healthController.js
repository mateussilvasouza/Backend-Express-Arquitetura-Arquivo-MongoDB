const mongoose = require('mongoose');

const DB_STATUS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

function health(req, res) {
  const state = mongoose.connection.readyState;
  const ready = state === 1;

  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: DB_STATUS[state] || 'unknown',
  });
}

module.exports = { health };
