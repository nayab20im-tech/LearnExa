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

/*
 * CLIENT_URL can contain one URL or multiple comma-separated URLs.
 *
 * Example:
 * CLIENT_URL=https://learn-exa-frontend.vercel.app,http://localhost:5173
 */
const configuredOrigins = () =>
  (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

const isAllowedOrigin = (origin) => {
  /*
   * Requests without an Origin header include:
   * - Direct browser visits
   * - Postman requests
   * - Server-to-server requests
   */
  if (!origin) {
    return true;
  }

  const normalizedOrigin = origin.replace(/\/$/, '');

  if (configuredOrigins().includes(normalizedOrigin)) {
    return true;
  }

  /*
   * Allow localhost only while not running in production.
   */
  return (
    process.env.NODE_ENV !== 'production' &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)
  );
};

/*
 * This promise prevents multiple database connections from being
 * created when several requests arrive at the same time.
 */
let initializationPromise = null;

const initializeForVercel = () => {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      /*
       * Validate the required environment variables.
       */
      validateEnvironment();

      /*
       * Configure Google Passport authentication.
       */
      configurePassport();

      /*
       * Connect to MongoDB only when not already connected.
       *
       * Mongoose ready states:
       * 0 = disconnected
       * 1 = connected
       * 2 = connecting
       * 3 = disconnecting
       */
      if (mongoose.connection.readyState !== 1) {
        await connectDB();
      }
    })().catch((error) => {
      /*
       * Reset the promise so another request can retry initialization.
       */
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
};

const createApp = ({ initializeDatabase = false } = {}) => {
  const app = express();

  app.disable('x-powered-by');

  /*
   * Security headers.
   */
  app.use(helmet());

  /*
   * Allow requests only from the configured frontend URL.
   */
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

      /*
       * Required because authentication uses cookies.
       */
      credentials: true,

      methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ],

      allowedHeaders: [
        'Content-Type',
        'Authorization',
      ],
    })
  );

  /*
   * On Vercel, src/server.js does not run as a normal permanent
   * Node.js server.
   *
   * Therefore, MongoDB and Passport are initialized before handling
   * the incoming serverless request.
   */
  if (initializeDatabase) {
    app.use(async (req, res, next) => {
      try {
        await initializeForVercel();
        next();
      } catch (error) {
        console.error(
          'Vercel backend initialization failed:',
          error
        );

        const initializationError = new Error(
          'Backend initialization failed. Check the Vercel runtime logs and environment variables.'
        );

        initializationError.statusCode = 503;
        next(initializationError);
      }
    });
  }

  /*
   * Request logging.
   */
  app.use(
    process.env.NODE_ENV === 'development'
      ? morgan('dev')
      : morgan('combined')
  );

  /*
   * Request body parsers.
   */
  app.use(
    express.json({
      limit: '10mb',
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    })
  );

  app.use(cookieParser());
  app.use(passport.initialize());

  /*
   * API rate limiter.
   */
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    max:
      process.env.NODE_ENV === 'production'
        ? 300
        : 1500,

    standardHeaders: true,
    legacyHeaders: false,

    /*
     * Do not count browser CORS preflight requests.
     */
    skip: (req) => req.method === 'OPTIONS',

    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
    },
  });

  app.use('/api', limiter);

  /*
   * Health-check response.
   */
  const healthResponse = (req, res) => {
    const states = [
      'disconnected',
      'connected',
      'connecting',
      'disconnecting',
    ];

    const readyState = mongoose.connection.readyState;
    const databaseConnected = readyState === 1;

    res
      .status(databaseConnected ? 200 : 503)
      .json({
        success: databaseConnected,
        service: 'LearnExa API',
        database: states[readyState] || 'unknown',
        timestamp: new Date().toISOString(),
      });
  };

  /*
   * Root route.
   */
  app.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Welcome to the LearnExa API',
      health: '/api/health',
    });
  });

  /*
   * Health routes.
   */
  app.get('/health', healthResponse);
  app.get('/api/health', healthResponse);

  /*
   * Application API routes.
   */
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

  /*
   * Handle unknown routes.
   */
  app.use((req, res, next) => {
    const error = new Error(
      `Not Found - ${req.originalUrl}`
    );

    error.statusCode = 404;
    next(error);
  });

  /*
   * Global error handler.
   */
  app.use(errorHandler);

  return app;
};

/*
 * Vercel requires the default CommonJS export to be an Express
 * application or request-handler function.
 */
const vercelApp = createApp({
  initializeDatabase: true,
});

module.exports = vercelApp;

/*
 * Preserve compatibility with src/server.js and automated tests.
 */
module.exports.createApp = createApp;
module.exports.isAllowedOrigin = isAllowedOrigin;
module.exports.initializeForVercel = initializeForVercel;
