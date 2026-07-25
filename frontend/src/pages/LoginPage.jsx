import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaGoogle,
  FaLock,
  FaLongArrowAltRight
} from 'react-icons/fa';
import api, { getApiErrorMessage, getGoogleAuthUrl } from '../api/client';
import AuthVisual from '../components/AuthVisual';
import LogoIcon from '../components/LogoIcon';
import '../styles/Auth.css';

const LoginPage = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedRole = location.state?.role || 'Student';

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post(
        '/auth/login',
        { email, password },
        { withCredentials: true }
      );

      if (data.success) {
        onAuthenticated(data.user);
        navigate('/dashboard', { replace: true });
      }
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Sign in failed. Check your email and password.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-visual-column">
          <AuthVisual mode="login" />
        </section>

        <section className="auth-form-column">
          <div className="auth-mobile-brand">
            <LogoIcon size={38} />
            <div>
              <strong>LearnExa</strong>
              <span>Learn · Explore · Excel</span>
            </div>
          </div>

          <button className="back-button" type="button" onClick={() => navigate('/')}>
            <FaArrowLeft />
            Back to home
          </button>

          <div className="form-container login-form-container">
            <div className="form-header">
              <span className="auth-role-label">{selectedRole} workspace</span>
              <h2>Sign in to LearnExa</h2>
              <p>Access your assessments, progress, feedback, and latest updates.</p>
            </div>

            {error && (
              <Alert variant="danger" className="error-alert">
                {error}
              </Alert>
            )}

            <Form onSubmit={handleLogin} className="login-form">
              <Form.Group className="auth-field">
                <Form.Label>Email address</Form.Label>
                <div className="input-group-custom">
                  <FaEnvelope className="input-icon" />
                  <Form.Control
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </Form.Group>

              <Form.Group className="auth-field">
                <div className="auth-label-row">
                  <Form.Label>Password</Form.Label>
                  <span>Minimum 6 characters</span>
                </div>

                <div className="input-group-custom">
                  <FaLock className="input-icon" />
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </Form.Group>

              <div className="auth-help-row">
                <label>
                  <input type="checkbox" />
                  Remember me
                </label>
                <span>Secure student and educator access</span>
              </div>

              <Button type="submit" className="btn-login" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <FaLongArrowAltRight />
                  </>
                )}
              </Button>
            </Form>

            <div className="divider">
              <span>or continue with</span>
            </div>

            <Button
              className="btn-google"
              onClick={() => {
                window.location.href = getGoogleAuthUrl();
              }}
              disabled={loading}
            >
              <FaGoogle />
              Continue with Google
            </Button>

            <div className="signup-link">
              New to LearnExa?{' '}
              <button type="button" onClick={() => navigate('/register')}>
                Create an account
              </button>
            </div>

            <p className="auth-privacy-note">
              Secure sign-in with role-based access and protected learning data.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default LoginPage;
