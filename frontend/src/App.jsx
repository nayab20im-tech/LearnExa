import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import api from './api/client';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentDashboard from './pages/StudentDashboard';
import QuizAttempt from './pages/QuizAttempt';
import QuizResults from './pages/QuizResults';
import TeacherDashboard from './pages/TeacherDashboard';
import CreateQuiz from './pages/CreateQuiz';
import Leaderboard from './pages/Leaderboard';
import AdminDashboard from './pages/AdminDashboard';
import LiveMonitoring from './pages/LiveMonitoring';
import PendingEvaluations from './pages/PendingEvaluations';
import ManageUsers from './pages/ManageUsers';
import LogoIcon from './components/LogoIcon';
import './styles/ModernUI.css';

function AppContent() {
  const [systemRole, setSystemRole] = useState('Public');
  const [currentUser, setCurrentUser] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleAuthenticated = (user) => {
    setSystemRole(user.role);
    setCurrentUser(user);
    localStorage.setItem('user', JSON.stringify(user));
  };

  const handleUserUpdated = (user) => {
    setCurrentUser(user);
    localStorage.setItem('user', JSON.stringify(user));
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await api.get('/auth/me', {
          withCredentials: true
        });
        if (data.success) {
          handleAuthenticated(data.user);
        }
      } catch {
        setSystemRole('Public');
        setCurrentUser(null);
        localStorage.removeItem('user');
      } finally {
        setAppLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (appLoading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-logo"><LogoIcon size={34} variant="white" /></div>
        <div className="app-loading-copy">
          <strong>LearnExa</strong>
          <span>Preparing your learning space...</span>
        </div>
        <div className="app-loading-bar"><span /></div>
      </div>
    );
  }

  if (systemRole === 'Public') {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage onAuthenticated={handleAuthenticated} />} />
        <Route path="/register" element={<RegisterPage onAuthenticated={handleAuthenticated} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-is-open' : ''}`}>
      <button
        className="sidebar-backdrop"
        aria-label="Close navigation"
        onClick={() => setSidebarOpen(false)}
      />

      <aside className="app-sidebar">
        <Sidebar
          systemRole={systemRole}
          setSystemRole={setSystemRole}
          setCurrentUser={setCurrentUser}
          onNavigate={() => setSidebarOpen(false)}
        />
      </aside>

      <main className="app-main">
        <Header
          systemRole={systemRole}
          currentUser={currentUser}
          onUserUpdated={handleUserUpdated}
          onMenuToggle={() => setSidebarOpen((open) => !open)}
        />

        <section className="app-page">
          <Routes>
            <Route path="/leaderboard" element={<Leaderboard />} />

            {systemRole === 'Student' && (
              <>
                <Route path="/dashboard" element={<StudentDashboard />} />
                <Route path="/quiz/:quizId/attempt" element={<QuizAttempt />} />
                <Route path="/results/:submissionId" element={<QuizResults />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </>
            )}

            {systemRole === 'Teacher' && (
              <>
                <Route path="/dashboard" element={<TeacherDashboard />} />
                <Route path="/create-quiz" element={<CreateQuiz />} />
                <Route path="/proctoring" element={<LiveMonitoring />} />
                <Route path="/evaluations" element={<PendingEvaluations />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </>
            )}

            {systemRole === 'Admin' && (
              <>
                <Route path="/dashboard" element={<AdminDashboard />} />
                <Route path="/manage-users" element={<ManageUsers />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </>
            )}
          </Routes>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
