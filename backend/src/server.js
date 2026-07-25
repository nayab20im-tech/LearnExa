const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const envPath = path.resolve(__dirname, '../.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.error && process.env.NODE_ENV !== 'test') {
  console.warn(`⚠️ Could not load .env from ${envPath}: ${envResult.error.message}`);
}

const connectDB = require('./config/db');
const { validateEnvironment } = require('./config/env');
const { configurePassport } = require('./config/passport');
const { createApp } = require('./app');
const { backfillQuizAccessCodes } = require('./services/quizAccess.service');

let server;

const startServer = async () => {
  validateEnvironment();
  configurePassport();
  await connectDB();
  await backfillQuizAccessCodes();

  const app = createApp();
  const port = Number(process.env.PORT) || 5000;

  server = app.listen(port, () => {
    console.log(`🚀 LearnExa API running on http://localhost:${port}`);
  });

  return { app, server };
};

const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down safely...`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await mongoose.disconnect();
  process.exit(0);
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`❌ Server startup failed: ${error.message}`);
    process.exit(1);
  });

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
  });
}

module.exports = { startServer };
