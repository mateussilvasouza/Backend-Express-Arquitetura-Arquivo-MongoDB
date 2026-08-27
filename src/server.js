require('dotenv').config();
const app = require('./app');
const { connect } = require('./config/database');

const PORT = process.env.PORT || 3333;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27028/desafio_senior';

async function bootstrap() {
  try {
    console.log('Conectando ao MongoDB...');
    await connect(MONGO_URI);
    console.log('✅ MongoDB conectado com sucesso');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando com sucesso na porta ${PORT}`);
      console.log(`👉 Healthcheck: http://localhost:${PORT}/health`);
      console.log(`👉 Cursos: http://localhost:${PORT}/courses`);
    });
  } catch (error) {
    console.error('❌ Falha ao inicializar o servidor:', error);
    process.exit(1);
  }
}

bootstrap();
