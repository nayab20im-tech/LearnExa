import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaBuilding,
  FaChalkboardTeacher,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaGoogle,
  FaIdCard,
  FaLock,
  FaLongArrowAltRight,
  FaUser,
  FaUserGraduate
} from 'react-icons/fa';
import api, { getApiErrorMessage, getGoogleAuthUrl } from '../api/client';
import AuthVisual from '../components/AuthVisual';
import LogoIcon from '../components/LogoIcon';
import '../styles/Auth.css';

const RegisterPage = ({ onAuthenticated }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Student',
    rollNo: '',
    department: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match. Please enter the same password twice.');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        rollNo: form.role === 'Student' ? form.rollNo : undefined,
        department: form.department
      });

      if (data.success) {
        setSuccess('Your account is ready. Opening your workspace...');
        onAuthenticated(data.user);
        setTimeout(() => navigate('/dashboard', { replace: true }), 450);
      }
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Account creation failed. Please review your information.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page auth-register-page">
      <div className="auth-shell auth-register-shell">
        <section className="auth-visual-column">
          <AuthVisual mode="register" />
        </section>

        <section className="auth-form-column auth-register-form-column">
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

          <div className="form-container register-form-container">
            <div className="form-header register-form-header">
              <span className="auth-role-label">Create your workspace</span>
              <h2>Create your LearnExa account</h2>
              <p>Choose your role and set up a focused learning workspace.</p>
            </div>

            {error && (
              <Alert variant="danger" className="error-alert">
                {error}
              </Alert>
            )}
            {success && <Alert variant="success">{success}</Alert>}

            <Form onSubmit={handleRegister} className="login-form register-form">
              <div className="role-selector" aria-label="Choose account role">
                {['Student', 'Teacher'].map((role) => (
                  <button
                    type="button"
                    key={role}
                    className={form.role === role ? 'selected' : ''}
                    onClick={() => update('role', role)}
                  >
                    <span>
                      {role === 'Student' ? <FaUserGraduate /> : <FaChalkboardTeacher />}
                    </span>
                    <div>
                      <strong>{role}</strong>
                      <small>
                        {role === 'Student'
                          ? 'Take quizzes and track progress'
                          : 'Create and evaluate assessments'}
                      </small>
                    </div>
                  </button>
                ))}
              </div>

              <div className="auth-form-grid">
                <Form.Group className="auth-field">
                  <Form.Label>Full name</Form.Label>
                  <div className="input-group-custom">
                    <FaUser className="input-icon" />
                    <Form.Control
                      type="text"
                      placeholder="Your full name"
                      value={form.name}
                      onChange={(event) => update('name', event.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                </Form.Group>

                <Form.Group className="auth-field">
                  <Form.Label>Email address</Form.Label>
                  <div className="input-group-custom">
                    <FaEnvelope className="input-icon" />
                    <Form.Control
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(event) => update('email', event.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </Form.Group>

                <Form.Group className="auth-field">
                  <Form.Label>Department</Form.Label>
                  <div className="input-group-custom">
                    <FaBuilding className="input-icon" />
                    <Form.Control
                      type="text"
                      placeholder="e.g. Data Science"
                      value={form.department}
                      onChange={(event) => update('department', event.target.value)}
                    />
                  </div>
                </Form.Group>

                {form.role === 'Student' ? (
                  <Form.Group className="auth-field">
                    <Form.Label>Roll number</Form.Label>
                    <div className="input-group-custom">
                      <FaIdCard className="input-icon" />
                      <Form.Control
                        type="text"
                        placeholder="e.g. 231980004"
                        value={form.rollNo}
                        onChange={(event) => update('rollNo', event.target.value)}
                      />
                    </div>
                  </Form.Group>
                ) : (
                  <div className="auth-field auth-role-note">
                    <strong>Educator workspace</strong>
                    <span>Create quizzes, review submissions, and monitor active sessions.</span>
                  </div>
                )}

                <Form.Group className="auth-field">
                  <Form.Label>Password</Form.Label>
                  <div className="input-group-custom">
                    <FaLock className="input-icon" />
                    <Form.Control
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={form.password}
                      onChange={(event) => update('password', event.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
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

                <Form.Group className="auth-field">
                  <Form.Label>Confirm password</Form.Label>
                  <div className="input-group-custom">
                    <FaLock className="input-icon" />
                    <Form.Control
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={form.confirmPassword}
                      onChange={(event) => update('confirmPassword', event.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowConfirm((visible) => !visible)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </Form.Group>
              </div>

              <Button type="submit" className="btn-login" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
                    <FaLongArrowAltRight />
                  </>
                )}
              </Button>
            </Form>

            <div className="divider">
              <span>or register with</span>
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
              Already registered?{' '}
              <button type="button" onClick={() => navigate('/login')}>
                Sign in
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default RegisterPage;
