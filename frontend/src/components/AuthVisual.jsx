import {
  FaChartLine,
  FaCheck,
  FaLock,
  FaMagic,
  FaTrophy
} from 'react-icons/fa';
import LogoIcon from './LogoIcon';

const AuthVisual = ({ mode = 'login' }) => {
  const isLogin = mode === 'login';

  const items = isLogin
    ? [
        { icon: <FaCheck />, text: 'Resume assessments' },
        { icon: <FaChartLine />, text: 'Track your progress' },
        { icon: <FaTrophy />, text: 'Review results and rankings' }
      ]
    : [
        { icon: <FaMagic />, text: 'Create smarter assessments' },
        { icon: <FaLock />, text: 'Use secure role-based access' },
        { icon: <FaChartLine />, text: 'Turn results into insight' }
      ];

  return (
    <aside className="auth-showcase" aria-label="LearnExa introduction">
      <div className="auth-showcase-grid" aria-hidden="true" />
      <div className="auth-liquid auth-liquid-one" aria-hidden="true" />
      <div className="auth-liquid auth-liquid-two" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-two" aria-hidden="true" />

      <div className="auth-showcase-inner">
        <div className="auth-brand-lockup">
          <LogoIcon size={46} />
          <div>
            <strong>LearnExa</strong>
            <span>Learn · Explore · Excel</span>
          </div>
        </div>

        <div className="auth-welcome-card">
          <div className="auth-welcome-icon">
            <LogoIcon size={56} />
          </div>

          <span className="auth-welcome-eyebrow">
            {isLogin ? 'Welcome back' : 'Start with LearnExa'}
          </span>

          <h1>
            {isLogin ? (
              <>
                Continue from where
                <br />
                you left off.
              </>
            ) : (
              <>
                Create a workspace
                <br />
                built for progress.
              </>
            )}
          </h1>

          <p>
            {isLogin
              ? 'Your quizzes, feedback, reports, and learning progress are ready in one focused space.'
              : 'Bring assessments, secure attempts, meaningful feedback, and analytics into one connected platform.'}
          </p>

          <div className="auth-benefit-list">
            {items.map((item) => (
              <div className="auth-benefit-item" key={item.text}>
                <span>{item.icon}</span>
                <strong>{item.text}</strong>
                <i aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>

        <div className="auth-showcase-footer">
          <span><FaLock /> Secure by design</span>
          <span>Focused learning, without clutter</span>
        </div>
      </div>
    </aside>
  );
};

export default AuthVisual;
