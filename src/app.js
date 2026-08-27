const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

// ---------------------------------------------------------------------------
// NOTA PARA O CANDIDATO:
// Esta aplicação é intencionalmente pequena. Organize o novo código de forma
// proporcional ao desafio e refatore o que considerar útil. Não existe um padrão
// arquitetural ou uma quantidade mínima de camadas obrigatória.
// ---------------------------------------------------------------------------

const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json());

app.use(routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
