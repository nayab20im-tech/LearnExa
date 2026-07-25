import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowRight,
  FaBars,
  FaBell,
  FaBolt,
  FaBrain,
  FaChartLine,
  FaCheck,
  FaChalkboardTeacher,
  FaGraduationCap,
  FaLayerGroup,
  FaMagic,
  FaPlay,
  FaShieldAlt,
  FaTimes,
  FaTrophy,
  FaUserShield
} from 'react-icons/fa';
import LogoIcon from '../components/LogoIcon';
import '../styles/LandingPage.css';

const roles = {
  student: {
    eyebrow: 'Student workspace',
    title: 'Know what is next, and why it matters.',
    description:
      'See upcoming assessments, instant results, personal feedback, progress trends, and live class rank in one calm workspace.',
    bullets: ['Upcoming assessments at a glance', 'Actionable feedback after every attempt', 'Progress, achievements, and live rank'],
    button: 'Explore student workspace',
    icon: FaGraduationCap,
    accent: 'blue'
  },
  educator: {
    eyebrow: 'Educator workspace',
    title: 'Create and evaluate without switching tools.',
    description:
      'Build quizzes manually or with AI, publish securely, monitor active sessions, review answers, and download useful reports.',
    bullets: ['Manual and AI-assisted creation', 'Live monitoring and pending evaluations', 'Class insights and exportable reports'],
    button: 'Explore educator workspace',
    icon: FaChalkboardTeacher,
    accent: 'teal'
  },
  admin: {
    eyebrow: 'Administrator workspace',
    title: 'Keep the platform organised and secure.',
    description:
      'Manage users, roles, account access, and platform activity through a focused operational view designed for clarity.',
    bullets: ['User and role management', 'Account status and access control', 'System activity and platform overview'],
    button: 'Explore admin workspace',
    icon: FaUserShield,
    accent: 'coral'
  }
};

const featureRows = [
  {
    number: '01',
    icon: FaMagic,
    eyebrow: 'Create with control',
    title: 'Start with AI, finish with your own judgement.',
    text: 'Generate a useful first draft, then edit every question, mark, option, timing rule, and access setting before publishing.',
    visual: 'draft'
  },
  {
    number: '02',
    icon: FaShieldAlt,
    eyebrow: 'Run with confidence',
    title: 'A secure attempt experience that stays out of the way.',
    text: 'Access codes, focused sessions, timers, autosave, and live monitoring protect assessment integrity without confusing students.',
    visual: 'session'
  },
  {
    number: '03',
    icon: FaChartLine,
    eyebrow: 'Improve with evidence',
    title: 'Turn every result into a clear next step.',
    text: 'Scores, reports, focus areas, and leaderboard movement help learners improve and educators understand the whole class.',
    visual: 'insights'
  }
];

function FluidBackdrop() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext('2d');
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const blobs = [
      { x: 0.76, y: 0.18, radius: 0.34, color: '47,107,255', speed: 0.00014, phase: 0 },
      { x: 0.9, y: 0.7, radius: 0.3, color: '32,191,175', speed: 0.00011, phase: 2.1 },
      { x: 0.14, y: 0.62, radius: 0.27, color: '255,132,93', speed: 0.00009, phase: 4.2 }
    ];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time) => {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';

      blobs.forEach((blob, index) => {
        const travelX = Math.sin(time * blob.speed + blob.phase) * width * (0.05 + index * 0.012);
        const travelY = Math.cos(time * blob.speed * 0.82 + blob.phase) * height * (0.04 + index * 0.01);
        const x = width * blob.x + travelX;
        const y = height * blob.y + travelY;
        const radius = Math.max(width, height) * blob.radius;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(${blob.color},0.24)`);
        gradient.addColorStop(0.42, `rgba(${blob.color},0.11)`);
        gradient.addColorStop(1, `rgba(${blob.color},0)`);
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      });

      context.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="lx-fluid-canvas" aria-hidden="true" />;
}

function Brand() {
  return (
    <div className="lx-brand-lockup">
      <span className="lx-brand-mark"><LogoIcon size={30} /></span>
      <span>
        <strong>LearnExa</strong>
        <small>LEARN · EXPLORE · EXCEL</small>
      </span>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="lx-product-scene" aria-label="LearnExa student dashboard preview">
      <div className="lx-orbit-ring lx-orbit-ring-one" />
      <div className="lx-orbit-ring lx-orbit-ring-two" />

      <div className="lx-orbit-track lx-orbit-track-one">
        <div className="lx-orbit-chip">
          <span className="teal"><FaCheck /></span>
          <div><small>Evaluation</small><strong>Feedback ready</strong></div>
        </div>
      </div>
      <div className="lx-orbit-track lx-orbit-track-two">
        <div className="lx-orbit-chip">
          <span className="blue"><FaShieldAlt /></span>
          <div><small>Live session</small><strong>Attempt secured</strong></div>
        </div>
      </div>
      <div className="lx-orbit-track lx-orbit-track-three">
        <div className="lx-orbit-chip">
          <span className="coral"><FaTrophy /></span>
          <div><small>Leaderboard</small><strong>Moved to #04</strong></div>
        </div>
      </div>

      <div className="lx-browser-card">
        <div className="lx-browser-topbar">
          <div className="lx-window-dots"><i /><i /><i /></div>
          <span>app.learnexa.io / student</span>
          <span className="lx-live-dot"><i /> Live</span>
        </div>

        <div className="lx-browser-body">
          <aside className="lx-preview-sidebar">
            <LogoIcon size={26} />
            <span className="active"><FaLayerGroup /></span>
            <span><FaBolt /></span>
            <span><FaChartLine /></span>
            <span><FaTrophy /></span>
          </aside>

          <main className="lx-preview-main">
            <header className="lx-preview-heading">
              <div>
                <small>GOOD AFTERNOON, LEARNER</small>
                <h3>Your next milestone is ready.</h3>
              </div>
              <button aria-label="Notifications"><FaBell /></button>
            </header>

            <div className="lx-preview-stats">
              <div><span>Average score</span><strong>86%</strong><small>↑ 8% this month</small></div>
              <div><span>Current rank</span><strong>#04</strong><small>Top 12% of class</small></div>
              <div><span>Completed</span><strong>18</strong><small>3 this week</small></div>
            </div>

            <div className="lx-preview-grid">
              <section className="lx-chart-card">
                <div className="lx-card-title"><strong>Learning progress</strong><span>Last 6 assessments</span></div>
                <svg viewBox="0 0 520 190" role="img" aria-label="Animated progress chart">
                  <defs>
                    <linearGradient id="lxChartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2f6bff" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#2f6bff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path className="lx-chart-area" d="M18 160 C80 154 92 140 138 132 C194 122 206 93 260 96 C323 98 340 67 390 70 C439 72 464 46 502 24 L502 178 L18 178 Z" />
                  <path className="lx-chart-line" d="M18 160 C80 154 92 140 138 132 C194 122 206 93 260 96 C323 98 340 67 390 70 C439 72 464 46 502 24" />
                  {[['18','160'],['138','132'],['260','96'],['390','70'],['502','24']].map(([cx, cy]) => (
                    <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" />
                  ))}
                </svg>
              </section>

              <section className="lx-up-next-card">
                <div className="lx-course-icon"><FaBrain /></div>
                <small>UP NEXT</small>
                <strong>Database Systems</strong>
                <span>10 questions · 20 minutes</span>
                <button onClick={() => {}}>Start quiz <FaArrowRight /></button>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function FeatureVisual({ type }) {
  if (type === 'draft') {
    return (
      <div className="lx-row-visual lx-draft-visual">
        <div className="lx-visual-toolbar"><span>AI draft</span><i /></div>
        <div className="lx-visual-line long" /><div className="lx-visual-line medium" />
        <div className="lx-draft-tags"><span>MCQ</span><span>20 marks</span><span>Medium</span></div>
        <button>Generate draft <FaArrowRight /></button>
      </div>
    );
  }

  if (type === 'session') {
    return (
      <div className="lx-row-visual lx-session-visual">
        <div><i className="green" /><span>Ayesha Malik</span><small>Question 8/10</small></div>
        <div><i className="blue" /><span>Fatima Sohail</span><small>Question 6/10</small></div>
        <div><i className="coral" /><span>Namra Noor</span><small>Question 9/10</small></div>
      </div>
    );
  }

  return (
    <div className="lx-row-visual lx-insight-visual">
      <div className="lx-mini-score"><strong>86%</strong><span>class average</span></div>
      <div className="lx-mini-bars">
        {[42, 58, 51, 73, 68, 86, 78].map((height, index) => <i key={index} style={{ '--bar-height': `${height}%` }} />)}
      </div>
      <span className="lx-trend">Strong upward trend</span>
    </div>
  );
}

function RolePreview({ role }) {
  const content = roles[role];
  const Icon = content.icon;

  return (
    <div className={`lx-role-panel ${content.accent}`} key={role}>
      <div className="lx-role-copy">
        <span className="lx-role-icon"><Icon /></span>
        <small>{content.eyebrow}</small>
        <h3>{content.title}</h3>
        <p>{content.description}</p>
        <ul>
          {content.bullets.map((item) => <li key={item}><FaCheck /> {item}</li>)}
        </ul>
        <button>{content.button} <FaArrowRight /></button>
      </div>

      <div className="lx-role-screen">
        <div className="lx-role-screen-head">
          <Brand />
          <span><i /> LIVE INSIGHTS</span>
        </div>
        <div className="lx-role-screen-stats">
          <div><span>Average score</span><strong>{role === 'admin' ? '1,284' : '86%'}</strong><small>{role === 'admin' ? 'active users' : '+8% this month'}</small></div>
          <div><span>{role === 'student' ? 'Completed' : role === 'educator' ? 'Published' : 'Roles'}</span><strong>{role === 'student' ? '18' : role === 'educator' ? '12' : '3'}</strong><small>up to date</small></div>
          <div><span>{role === 'student' ? 'Class rank' : role === 'educator' ? 'Needs review' : 'Online now'}</span><strong>{role === 'student' ? '#04' : role === 'educator' ? '08' : '96'}</strong><small>live</small></div>
        </div>
        <div className="lx-role-screen-grid">
          <section>
            <header><strong>Performance overview</strong><span>Last 30 days</span></header>
            <svg viewBox="0 0 500 180" aria-hidden="true">
              <defs>
                <linearGradient id={`roleFill-${role}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={role === 'teal' ? '#20bfaf' : '#2f6bff'} stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="area" d="M15 148 C80 145 96 126 144 126 C199 126 208 98 270 100 C335 101 351 71 405 70 C452 70 465 45 488 30 L488 166 L15 166 Z" />
              <path className="line" d="M15 148 C80 145 96 126 144 126 C199 126 208 98 270 100 C335 101 351 71 405 70 C452 70 465 45 488 30" />
            </svg>
          </section>
          <aside>
            <strong>Recent activity</strong>
            <div><i className="blue" /><span>New assessment available</span></div>
            <div><i className="teal" /><span>Feedback published</span></div>
            <div><i className="coral" /><span>Ranking updated</span></div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const heroVisualRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeRole, setActiveRole] = useState('student');

  const openLogin = (role = 'Student') => navigate('/login', { state: { role } });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      }),
      { threshold: 0.12, rootMargin: '0px 0px -70px' }
    );

    document.querySelectorAll('.lx-reveal').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const handleHeroPointer = (event) => {
    const target = heroVisualRef.current;
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    target.style.setProperty('--tilt-y', `${x * 5.5}deg`);
    target.style.setProperty('--tilt-x', `${y * -4.5}deg`);
    target.style.setProperty('--spot-x', `${(x + 0.5) * 100}%`);
    target.style.setProperty('--spot-y', `${(y + 0.5) * 100}%`);
  };

  const resetHeroPointer = () => {
    if (!heroVisualRef.current) return;
    heroVisualRef.current.style.setProperty('--tilt-y', '0deg');
    heroVisualRef.current.style.setProperty('--tilt-x', '0deg');
  };

  return (
    <div className="lx-landing">
      <header className="lx-site-header">
        <div className="lx-header-inner">
          <button className="lx-logo-button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="LearnExa home">
            <Brand />
          </button>

          <nav className={`lx-main-nav ${menuOpen ? 'open' : ''}`} aria-label="Primary navigation">
            <a href="#platform" onClick={() => setMenuOpen(false)}>Platform</a>
            <a href="#workflow" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#workspaces" onClick={() => setMenuOpen(false)}>Workspaces</a>
          </nav>

          <div className="lx-header-actions">
            <button className="lx-login-link" onClick={() => openLogin('Student')}>Log in</button>
            <button className="lx-header-cta" onClick={() => navigate('/register')}>Start free <FaArrowRight /></button>
            <button className="lx-menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle menu">
              {menuOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="lx-hero">
          <FluidBackdrop />
          <div className="lx-water-mesh" aria-hidden="true" />
          <div className="lx-hero-grid">
            <div className="lx-hero-copy lx-reveal is-visible">
              <div className="lx-eyebrow"><FaMagic /> One connected learning experience</div>
              <h1>Assessment that moves learning <span>forward.</span></h1>
              <p>
                LearnExa brings quiz creation, secure attempts, intelligent evaluation, feedback, analytics, and live progress into one focused platform.
              </p>
              <div className="lx-hero-actions">
                <button className="lx-primary-button" onClick={() => navigate('/register')}>Create your workspace <FaArrowRight /></button>
                <button className="lx-secondary-button" onClick={() => openLogin('Student')}><FaPlay /> Explore student view</button>
              </div>
              <div className="lx-hero-proof">
                <span><FaCheck /> AI-assisted evaluation</span>
                <span><FaCheck /> Secure attempts</span>
                <span><FaCheck /> Live learning analytics</span>
              </div>
            </div>

            <div
              className="lx-hero-visual lx-reveal is-visible"
              ref={heroVisualRef}
              onPointerMove={handleHeroPointer}
              onPointerLeave={resetHeroPointer}
            >
              <ProductPreview />
            </div>
          </div>
        </section>

        <section className="lx-metric-band" aria-label="Platform highlights">
          <div><strong>3</strong><span>role-aware workspaces</span></div>
          <div><strong>1</strong><span>connected assessment flow</span></div>
          <div><strong>Live</strong><span>monitoring and rankings</span></div>
          <div><strong>AI</strong><span>creation and feedback support</span></div>
        </section>

        <section className="lx-platform-section" id="platform">
          <div className="lx-section-intro lx-reveal">
            <span className="lx-section-kicker">A calmer product experience</span>
            <h2>Every screen has one job. Nothing fights for attention.</h2>
            <p>LearnExa keeps the interface quiet, so the most important action is always obvious.</p>
          </div>

          <div className="lx-feature-layout">
            <aside className="lx-feature-sticky lx-reveal">
              <span>01—03</span>
              <h3>From a first idea to a useful learning decision.</h3>
              <p>Three connected stages replace scattered tools, repeated setup, and disconnected results.</p>
              <a href="#workflow">See the complete flow <FaArrowRight /></a>
            </aside>

            <div className="lx-feature-rows">
              {featureRows.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article className="lx-feature-row lx-reveal" key={feature.number}>
                    <span className="lx-feature-number">{feature.number}</span>
                    <div className="lx-feature-copy">
                      <div className="lx-feature-icon"><Icon /></div>
                      <small>{feature.eyebrow}</small>
                      <h3>{feature.title}</h3>
                      <p>{feature.text}</p>
                    </div>
                    <FeatureVisual type={feature.visual} />
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lx-workflow-section" id="workflow">
          <div className="lx-workflow-glow" aria-hidden="true" />
          <div className="lx-workflow-inner">
            <div className="lx-workflow-copy lx-reveal">
              <span className="lx-section-kicker">One continuous assessment loop</span>
              <h2>Ideas become insight without breaking the flow.</h2>
              <p>Create, deliver, evaluate, and improve in one connected path from the first question to the next teaching decision.</p>
              <button onClick={() => navigate('/register')}>Experience LearnExa <FaArrowRight /></button>
            </div>

            <div className="lx-flow-track lx-reveal">
              <div className="lx-flow-line"><i /></div>
              {[
                { step: '01', icon: FaMagic, title: 'Create', text: 'Build manually or begin with an AI-assisted draft.' },
                { step: '02', icon: FaShieldAlt, title: 'Attempt', text: 'Deliver a focused and secure assessment experience.' },
                { step: '03', icon: FaBrain, title: 'Evaluate', text: 'Combine automatic grading with thoughtful review.' },
                { step: '04', icon: FaChartLine, title: 'Improve', text: 'Use feedback and patterns to guide what happens next.' }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div className="lx-flow-step" key={item.step}>
                    <span><Icon /></span>
                    <small>{item.step}</small>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lx-workspaces-section" id="workspaces">
          <div className="lx-workspaces-header lx-reveal">
            <div>
              <span className="lx-section-kicker">Built around each role</span>
              <h2>One platform. Three focused experiences.</h2>
            </div>
            <p>Each person sees only the tools and information that help them move forward.</p>
          </div>

          <div className="lx-workspace-layout lx-reveal">
            <div className="lx-role-tabs" role="tablist" aria-label="Workspace roles">
              {Object.entries(roles).map(([key, role]) => {
                const Icon = role.icon;
                return (
                  <button
                    key={key}
                    className={activeRole === key ? 'active' : ''}
                    onClick={() => setActiveRole(key)}
                    role="tab"
                    aria-selected={activeRole === key}
                  >
                    <span className={role.accent}><Icon /></span>
                    <div><small>{role.eyebrow}</small><strong>{key[0].toUpperCase() + key.slice(1)}</strong></div>
                    <FaArrowRight />
                  </button>
                );
              })}
            </div>
            <RolePreview role={activeRole} />
          </div>
        </section>

        <section className="lx-final-cta">
          <div className="lx-final-cta-water" aria-hidden="true" />
          <div className="lx-final-cta-copy lx-reveal">
            <span>READY WHEN YOU ARE</span>
            <h2>Make every assessment a better learning moment.</h2>
            <p>Start a focused workspace for students, educators, and academic teams.</p>
          </div>
          <div className="lx-final-cta-actions lx-reveal">
            <button onClick={() => navigate('/register')}>Create free account <FaArrowRight /></button>
            <button onClick={() => openLogin('Student')}>Log in</button>
          </div>
        </section>
      </main>

      <footer className="lx-footer">
        <Brand />
        <p>A focused assessment platform for clearer learning and better outcomes.</p>
        <div className="lx-footer-links">
          <a href="#platform">Platform</a>
          <a href="#workflow">Workflow</a>
          <a href="#workspaces">Workspaces</a>
          <button onClick={() => openLogin('Student')}>Log in</button>
        </div>
        <span>© 2026 LearnExa. All rights reserved.</span>
      </footer>
    </div>
  );
}
