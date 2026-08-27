const mongoose = require('mongoose');

async function connect(uri) {
  await mongoose.connect(uri);
  return mongoose.connection;
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect };
