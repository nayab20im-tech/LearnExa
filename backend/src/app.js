const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const { validateEnvironment } = require('./config/env');
const { configurePassport } = require('./config/passport');
const { backfillQuizAccessCodes } = require('./services/quizAccess.service');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const profileRoutes = require('./routes/profile.routes');
const courseRoutes = require('./routes/course.routes');
const subjectRoutes = require('./routes/subject.routes');
const quizRoutes = require('./routes/quiz.routes');
const submissionRoutes = require('./routes/submission.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notificationRoutes = require('./routes/notification.routes');
const activityLogRoutes = require('./routes/activityLog.routes');

const configuredOrigins = () =>
  (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/$/, '');

  if (configuredOrigins().includes(normalizedOrigin)) {
    return true;
  }

  return (
    process.env.NODE_ENV !== 'production' &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)
  );
};

let initializationPromise = null;

const initializeForVercel = () => {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      validateEnvironment();
      configurePassport();

      if (mongoose.connection.readyState !== 1) {
        await connectDB();
      }

      await backfillQuizAccessCodes();
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
};

const createApp = ({ initializeDatabase = false } = {}) => {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        const error = new Error(
          `CORS blocked request from origin: ${origin}`
        );

        error.statusCode = 403;
        callback(error);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  /*
   * Vercel does not run src/server.js in the same way as a normal
   * long-running Node.js server. Therefore, initialize MongoDB and
   * other backend services before processing the first request.
   */
  if (initializeDatabase) {
    app.use(async (req, res, next) => {
      try {
        await initializeForVercel();
        next();
      } catch (error) {
        console.error('Vercel backend initialization failed:', error);

        const initializationError = new Error(
          'Backend initialization failed. Check the Vercel runtime logs and environment variables.'
        );

        initializationError.statusCode = 503;
        next(initializationError);
      }
    });
  }

  app.use(
    process.env.NODE_ENV === 'development'
      ? morgan('dev')
      : morgan('combined')
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    })
  );

  app.use(cookieParser());
  app.use(passport.initialize());

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 300 : 1500,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
    },
  });

  app.use('/api/', limiter);

  const healthResponse = (req, res) => {
    const states = [
      'disconnected',
      'connected',
      'connecting',
      'disconnecting',
    ];

    const readyState = mongoose.connection.readyState;
    const databaseConnected = readyState === 1;

    res.status(databaseConnected ? 200 : 503).json({
      success: databaseConnected,
      service: 'LearnExa API',
      database: states[readyState] || 'unknown',
      timestamp: new Date().toISOString(),
    });
  };

  app.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Welcome to the LearnExa API',
      health: '/api/health',
    });
  });

  app.get('/health', healthResponse);
  app.get('/api/health', healthResponse);

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/subjects', subjectRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/submissions', submissionRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/activity', activityLogRoutes);

  app.use((req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
  });

  app.use(errorHandler);

  return app;
};

/*
 * Vercel needs the default export to be an Express application
 * or another request-handling function.
 */
const vercelApp = createApp({
  initializeDatabase: true,
});

module.exports = vercelApp;

/*
 * These properties preserve compatibility with src/server.js
 * and any existing tests that import createApp.
 */
module.exports.createApp = createApp;
module.exports.isAllowedOrigin = isAllowedOrigin;
module.exports.initializeForVercel = initializeForVercel;
