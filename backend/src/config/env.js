const requiredVariables = ['MONGODB_URI', 'JWT_SECRET'];

const validateEnvironment = () => {
  const missing = requiredVariables.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`
    );
  }

  if (process.env.JWT_SECRET.trim().length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }
};

module.exports = { validateEnvironment };
