import { useEffect, useMemo, useState } from 'react';
import { Card, Spinner, Table } from 'react-bootstrap';
import { FaBolt, FaChartLine, FaMedal, FaSyncAlt, FaTrophy, FaUsers } from 'react-icons/fa';
import api from '../api/client';
import Avatar from '../components/Avatar';
import '../styles/Leaderboard.css';

const Leaderboard = () => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, []);

  const fetchLeaderboard = async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const { data } = await api.get('/leaderboard', { withCredentials: true });
      if (data.success) {
        setLeaderboardData(data.leaderboard || []);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const initial = window.setTimeout(fetchLeaderboard, 0);
    const interval = window.setInterval(() => fetchLeaderboard(true), 8000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  const topThree = leaderboardData.slice(0, 3);
  const totalAttempts = leaderboardData.reduce((sum, item) => sum + (item.quizzesAttempted || 0), 0);
  const classAverage = leaderboardData.length
    ? (leaderboardData.reduce((sum, item) => sum + (item.avgPercentage || 0), 0) / leaderboardData.length).toFixed(1)
    : 0;

  return (
    <div className="leaderboard-page">
      <Card className="leaderboard-hero">
        <div>
          <span className="leaderboard-kicker"><FaBolt /> Live class rankings</span>
          <h2>Every graded result can change the board.</h2>
          <p>Rankings use total score, average performance, and completed quizzes. The board refreshes automatically every eight seconds.</p>
        </div>
        <div className="leaderboard-live-box">
          <span className={`leaderboard-live-dot ${refreshing ? 'refreshing' : ''}`} />
          <div><strong>{refreshing ? 'Refreshing rankings…' : 'Live updates active'}</strong><small>{lastUpdated ? `Last update ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Connecting to results'}</small></div>
          <button onClick={() => fetchLeaderboard(true)} aria-label="Refresh leaderboard"><FaSyncAlt /></button>
        </div>
      </Card>

      <div className="leaderboard-summary-grid">
        <Card><span><FaUsers /></span><div><small>Active students</small><strong>{leaderboardData.length}</strong></div></Card>
        <Card><span><FaChartLine /></span><div><small>Class average</small><strong>{classAverage}%</strong></div></Card>
        <Card><span><FaTrophy /></span><div><small>Total attempts</small><strong>{totalAttempts}</strong></div></Card>
      </div>

      {loading ? (
        <div className="empty-panel"><Spinner animation="border" /><p>Calculating the current rankings…</p></div>
      ) : leaderboardData.length === 0 ? (
        <div className="empty-panel leaderboard-empty">
          <span className="empty-panel-icon"><FaUsers /></span>
          <strong>No rankings yet</strong>
          <p>Students will appear as soon as graded submissions are available.</p>
        </div>
      ) : (
        <>
          <section className="leaderboard-podium" aria-label="Top three students">
            {topThree.map((student, index) => (
              <Card key={student.studentId} className={`podium-person podium-rank-${index + 1} ${String(student.studentId) === String(currentUser?._id) ? 'is-current-user' : ''}`}>
                <span className="podium-rank-label">#{student.rank}</span>
                <span className="podium-medal"><FaMedal /></span>
                <Avatar avatar={student.avatar} size="lg" title={`${student.name} avatar`} />
                <strong>{student.name}</strong>
                <small>{student.rollNo}</small>
                <b>{student.avgPercentage}%</b>
                <div className="podium-detail"><span>{student.quizzesCompleted} graded</span><span>{student.totalScore} points</span></div>
                {String(student.studentId) === String(currentUser?._id) && <em>You</em>}
              </Card>
            ))}
          </section>

          <Card className="leaderboard-table-card overflow-hidden">
            <div className="leaderboard-table-heading">
              <div><h5>Complete ranking</h5><p>Automatically ordered using the latest graded submissions.</p></div>
              <span><i /> Live</span>
            </div>
            <Table responsive hover className="mb-0 align-middle leaderboard-table">
              <thead>
                <tr>
                  <th className="ps-4">Rank</th>
                  <th>Student</th>
                  <th>Average</th>
                  <th>Total points</th>
                  <th>Completed</th>
                  <th>Integrity</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardData.map((student) => {
                  const isCurrent = String(student.studentId) === String(currentUser?._id);
                  return (
                    <tr key={student.studentId} className={isCurrent ? 'current-student-row' : ''}>
                      <td className="ps-4"><span className={`rank-chip rank-${student.rank}`}>#{student.rank}</span></td>
                      <td>
                        <div className="leaderboard-student-cell">
                          <Avatar avatar={student.avatar} size="sm" title={`${student.name} avatar`} />
                          <div><strong>{student.name} {isCurrent && <em>You</em>}</strong><small>{student.rollNo} · {student.department}</small></div>
                        </div>
                      </td>
                      <td><strong className="score-value">{student.avgPercentage}%</strong></td>
                      <td>{student.totalScore}</td>
                      <td>{student.quizzesCompleted} / {student.quizzesAttempted}</td>
                      <td><span className={`integrity-chip ${student.warnings > 0 ? 'warning' : 'clear'}`}>{student.warnings > 0 ? `${student.warnings} alert${student.warnings === 1 ? '' : 's'}` : 'Clear'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
};

export default Leaderboard;
