const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User.model');

let googleAuthConfigured = false;

/*
 * Permanent Google OAuth callback for the deployed backend.
 */
const PRODUCTION_GOOGLE_CALLBACK_URL =
  'https://learn-exa-uspl.vercel.app/api/auth/google/callback';

const resolveGoogleCallbackURL = () => {
  /*
   * Always use the production backend callback on Vercel.
   */
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_GOOGLE_CALLBACK_URL;
  }

  /*
   * Local development callback.
   */
  return (
    process.env.GOOGLE_CALLBACK_URL?.trim().replace(/\/+$/, '') ||
    'http://localhost:5000/api/auth/google/callback'
  );
};

const configurePassport = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientID || !clientSecret) {
    console.warn(
      'Google login is disabled because GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.'
    );

    googleAuthConfigured = false;
    return false;
  }

  const callbackURL = resolveGoogleCallbackURL();

  /*
   * Safe debugging information.
   * The client secret is never printed.
   */
  console.log('[Google OAuth] Configuration:', {
    callbackURL,
    clientIdEnding: clientID.slice(-30),
    environment: process.env.NODE_ENV,
  });

  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email =
            profile.emails?.[0]?.value?.trim().toLowerCase();

          if (!email) {
            return done(
              new Error('Google did not provide an email address.'),
              null
            );
          }

          let user = await User.findOne({
            $or: [
              { googleId: profile.id },
              { email },
            ],
          }).select('+password');

          if (user) {
            user.googleId = profile.id;

            user.profileImage =
              profile.photos?.[0]?.value ||
              user.profileImage;

            user.lastLogin = new Date();

            await user.save();
          } else {
            user = await User.create({
              name:
                profile.displayName ||
                email.split('@')[0],

              email,

              password:
                `${profile.id}-${Date.now()}-${Math.random()}`,

              googleId: profile.id,

              profileImage:
                profile.photos?.[0]?.value || null,

              role: 'Student',
              status: 'Active',
              lastLogin: new Date(),
            });
          }

          return done(null, user);
        } catch (error) {
          console.error(
            '[Google OAuth] User processing failed:',
            error
          );

          return done(error, null);
        }
      }
    )
  );

  googleAuthConfigured = true;
  return true;
};

const isGoogleAuthConfigured = () =>
  googleAuthConfigured;

module.exports = {
  configurePassport,
  isGoogleAuthConfigured,
  resolveGoogleCallbackURL,
};
