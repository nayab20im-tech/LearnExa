const express = require('express');
const passport = require('passport');

const router = express.Router();

const {
  login,
  register,
  getMe,
  logout,
} = require('../controllers/auth.controller');

const { protect } = require('../middleware/auth.middleware');
const { isGoogleAuthConfigured } = require('../config/passport');
const {
  generateToken,
  setAuthCookie,
} = require('../utils/auth');

const getClientUrl = () =>
  (process.env.CLIENT_URL || 'http://localhost:5173')
    .trim()
    .replace(/\/+$/, '');

const requireGoogleAuth = (req, res, next) => {
  if (!isGoogleAuthConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Google login is not configured on this server.',
    });
  }

  return next();
};

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/logout', logout);

router.get(
  '/google',
  requireGoogleAuth,
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    prompt: 'select_account',
  })
);

router.get(
  '/google/callback',
  requireGoogleAuth,
  passport.authenticate('google', {
    failureRedirect:
      `${getClientUrl()}/login?error=google_auth_failed`,
    session: false,
  }),
  (req, res) => {
    const token = generateToken(req.user);

    /*
     * Keep cookie authentication for localhost and browsers
     * that allow cross-site cookies.
     */
    setAuthCookie(res, token);

    /*
     * Vercel frontend and backend use separate domains.
     * The JWT is therefore also returned through the URL fragment.
     *
     * The frontend stores it and removes it from the address bar.
     * URL fragments are not included in HTTP requests.
     */
    const redirectUrl =
      `${getClientUrl()}/dashboard` +
      `#oauth_token=${encodeURIComponent(token)}`;

    return res.redirect(redirectUrl);
  }
);

module.exports = router;
