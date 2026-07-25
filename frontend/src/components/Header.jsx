import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Dropdown } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FaBars,
  FaBell,
  FaBolt,
  FaCheckCircle,
  FaChevronDown,
  FaClipboardCheck,
  FaClock,
  FaMagic,
  FaSearch,
  FaTrophy,
  FaUserEdit
} from 'react-icons/fa';
import api from '../api/client';
import Avatar from './Avatar';
import AvatarStudio from './AvatarStudio';
import '../styles/Header.css';

const routeLabels = {
  '/dashboard': ['Dashboard', 'Your progress, priorities, and latest activity in one place.'],
  '/leaderboard': ['Live leaderboard', 'Rankings refresh automatically as graded results arrive.'],
  '/create-quiz': ['Create assessment', 'Build an engaging quiz with clear structure and smart tools.'],
  '/evaluations': ['Pending evaluations', 'Review short answers and publish meaningful feedback.'],
  '/proctoring': ['Live monitoring', 'Follow active quiz sessions and integrity signals in real time.'],
  '/manage-users': ['User management', 'Manage roles, access, and account status.']
};

const relativeTime = (dateValue) => {
  const time = new Date(dateValue).getTime();
  const difference = Math.max(0, Date.now() - time);
  const minutes = Math.floor(difference / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateValue).toLocaleDateString();
};

const notificationIcon = (type) => {
  if (type === 'quiz_published') return <FaBolt />;
  if (['quiz_graded', 'ai_grading_completed'].includes(type)) return <FaCheckCircle />;
  if (['manual_grading_pending', 'quiz_submitted'].includes(type)) return <FaClipboardCheck />;
  return <FaBell />;
};

const Header = ({ systemRole, currentUser, onUserUpdated, onMenuToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAvatarStudio, setShowAvatarStudio] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [search, setSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [pageTitle, pageSubtitle] = useMemo(() => {
    if (location.pathname.startsWith('/quiz/')) return ['Quiz session', 'Stay focused—your answers are saved as you move.'];
    if (location.pathname.startsWith('/results/')) return ['Assessment report', 'Review your score, feedback, and next learning steps.'];
    return routeLabels[location.pathname] || ['LearnExa', 'Your intelligent assessment workspace.'];
  }, [location.pathname]);

  const searchCommands = useMemo(() => {
    const shared = [
      { label: 'Dashboard', path: '/dashboard', icon: <FaBolt /> },
      { label: 'Live leaderboard', path: '/leaderboard', icon: <FaTrophy /> }
    ];
    const teacher = [
      { label: 'Create assessment', path: '/create-quiz', icon: <FaMagic /> },
      { label: 'Pending evaluations', path: '/evaluations', icon: <FaClipboardCheck /> },
      { label: 'Live monitoring', path: '/proctoring', icon: <FaBolt /> }
    ];
    const admin = [{ label: 'Manage users', path: '/manage-users', icon: <FaUserEdit /> }];
    return [
      ...shared.filter((item) => systemRole !== 'Teacher' || item.path !== '/leaderboard'),
      ...(systemRole === 'Teacher' ? teacher : []),
      ...(systemRole === 'Admin' ? admin : [])
    ];
  }, [systemRole]);

  const filteredCommands = searchCommands.filter((item) =>
    item.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications', { withCredentials: true });
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Notifications are non-blocking; keep the rest of the workspace usable.
    }
  };

  useEffect(() => {
    const initial = window.setTimeout(fetchNotifications, 0);
    const interval = window.setInterval(fetchNotifications, 12000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        setShowSearchResults(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all', {}, { withCredentials: true });
      setUnreadCount(0);
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    } catch {
      // Preserve current UI state when the request fails.
    }
  };

  const openNotification = async (notification) => {
    if (!notification.isRead) {
      try {
        await api.patch(`/notifications/${notification._id}/read`);
        setUnreadCount((count) => Math.max(0, count - 1));
        setNotifications((items) => items.map((item) =>
          item._id === notification._id ? { ...item, isRead: true } : item
        ));
      } catch {
        // Navigation should still work even if marking as read fails.
      }
    }

    const submissionId = notification.relatedSubmission?._id || notification.relatedSubmission;
    const quizId = notification.relatedQuiz?._id || notification.relatedQuiz;
    const target = notification.actionUrl
      || (submissionId && ['quiz_graded', 'feedback_received', 'feedback', 'teacher_comment'].includes(notification.type)
        ? `/results/${submissionId}`
        : quizId && notification.type === 'quiz_published'
          ? `/quiz/${quizId}/attempt`
          : ['manual_grading_pending', 'quiz_submitted', 'ai_grading_completed'].includes(notification.type)
            ? '/evaluations'
            : '/dashboard');

    setShowNotifications(false);
    navigate(target);
  };

  const selectCommand = (path) => {
    setSearch('');
    setShowSearchResults(false);
    navigate(path);
  };

  const userName = currentUser?.name || 'User';

  return (
    <>
      <AvatarStudio
        show={showAvatarStudio}
        onHide={() => setShowAvatarStudio(false)}
        user={currentUser}
        onSaved={onUserUpdated}
      />

      <header className="header-navbar">
        <div className="header-title-area">
          <button className="mobile-menu-button" onClick={onMenuToggle} aria-label="Open navigation">
            <FaBars />
          </button>
          <div>
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="header-search-wrap">
            <label className="header-search">
              <FaSearch className="search-icon" />
              <input
                ref={searchRef}
                type="search"
                placeholder="Jump to a page..."
                aria-label="Search navigation"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
              />
              <kbd>⌘ K</kbd>
            </label>
            {showSearchResults && (
              <div className="header-search-results">
                <span>Quick navigation</span>
                {filteredCommands.length === 0 ? (
                  <p>No matching page</p>
                ) : filteredCommands.map((command) => (
                  <button key={command.path} onMouseDown={() => selectCommand(command.path)}>
                    <i>{command.icon}</i>
                    <strong>{command.label}</strong>
                    <small>Open</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Dropdown show={showNotifications} onToggle={setShowNotifications} align="end">
            <Dropdown.Toggle as="button" className="notification-toggle" aria-label="Notifications">
              <FaBell size={17} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </Dropdown.Toggle>

            <Dropdown.Menu className="notification-menu">
              <div className="notification-header">
                <div>
                  <strong>Notifications</strong>
                  <span>Click an update to open its related page.</span>
                </div>
                {unreadCount > 0 && <Badge>{unreadCount} new</Badge>}
              </div>

              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="empty-state">
                    <span>✓</span>
                    <strong>You are all caught up</strong>
                    <small>New quiz and grading updates will appear here.</small>
                  </div>
                ) : (
                  notifications.slice(0, 12).map((notification) => (
                    <button
                      type="button"
                      key={notification._id}
                      onClick={() => openNotification(notification)}
                      className={`notification-item ${notification.isRead ? '' : 'unread'}`}
                    >
                      <span className="notification-type-icon">{notificationIcon(notification.type)}</span>
                      <span className="notification-content">
                        <strong>{notification.title}</strong>
                        <p>{notification.message}</p>
                        <span className="notification-time">
                          <FaClock size={10} /> {relativeTime(notification.createdAt)}
                        </span>
                      </span>
                      {!notification.isRead && <span className="notification-dot" />}
                    </button>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="notification-footer">
                  <Button variant="link" onClick={markAllAsRead} disabled={unreadCount === 0}>
                    Mark all as read
                  </Button>
                  <span>Auto-refreshes</span>
                </div>
              )}
            </Dropdown.Menu>
          </Dropdown>

          <Dropdown align="end">
            <Dropdown.Toggle as="button" className="user-profile">
              <Avatar avatar={currentUser?.avatar} size="xs" title={`${userName} profile avatar`} />
              <span className="user-info">
                <strong>{userName}</strong>
                <small>{systemRole}</small>
              </span>
              <FaChevronDown className="profile-chevron" size={10} />
            </Dropdown.Toggle>
            <Dropdown.Menu className="profile-menu">
              <div className="profile-menu-card">
                <Avatar avatar={currentUser?.avatar} size="sm" />
                <div><strong>{userName}</strong><small>{currentUser?.email}</small></div>
              </div>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => setShowAvatarStudio(true)}>
                <FaUserEdit /> Design my avatar
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </header>
    </>
  );
};

export default Header;
