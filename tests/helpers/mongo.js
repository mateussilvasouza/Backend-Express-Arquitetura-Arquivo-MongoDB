const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

async function connectTestDatabase() {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: process.env.MONGOMS_VERSION || '7.0.14'
    }
  });

  await mongoose.connect(mongoServer.getUri());
}

// Garante que os índices declarados nos schemas existam (o clear só faz deleteMany,
// não recria índices; testes de unicidade / matrícula ativa dependem deles).
async function syncIndexes() {
  const models = mongoose.modelNames().map((name) => mongoose.model(name));
  await Promise.all(models.map((model) => model.syncIndexes()));
}

async function clearTestDatabase() {
  if (mongoose.connection.readyState !== 1) return;

  await Promise.all(
    Object.values(mongoose.connection.collections)
      .map(collection => collection.deleteMany({}))
  );
}

async function disconnectTestDatabase() {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = undefined;
  }
}

module.exports = {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase,
  syncIndexes
};
