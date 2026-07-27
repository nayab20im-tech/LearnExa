import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  ProgressBar,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';
import {
  FaCheck,
  FaClipboardCheck,
  FaCopy,
  FaDesktop,
  FaDownload,
  FaEye,
  FaExclamationTriangle,
  FaLock,
  FaPaperPlane,
  FaRobot,
  FaShieldAlt,
  FaUnlock
} from 'react-icons/fa';
import api, { getApiErrorMessage } from '../api/client';
import Avatar from '../components/Avatar';

const formatDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}m ${remainingSeconds}s`;
};

const normalizeReviewQuestions = (submission) =>
  (submission?.questionsWithAnswers || []).map((item) => ({
    ...item,
    teacherScore:
      item.teacherScore ??
      item.finalScore ??
      item.aiScore ??
      0,
    teacherComment:
      item.teacherComment ||
      item.aiFeedback ||
      ''
  }));

const LiveMonitoring = () => {
  const [students, setStudents] = useState([]);
  const [recentEvaluations, setRecentEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [notice, setNotice] = useState(null);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [teacherFeedback, setTeacherFeedback] = useState('');

  const fetchLiveStats = useCallback(async () => {
    try {
      const { data } = await api.get('/activity/live', {
        withCredentials: true
      });

      if (data.success) {
        setStudents(data.liveData || []);
        setRecentEvaluations(data.recentEvaluations || []);
      }
    } catch (error) {
      console.error('Error fetching live stats', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(fetchLiveStats, 0);
    const interval = window.setInterval(fetchLiveStats, 5000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [fetchLiveStats]);

  const sendWarning = async (student) => {
    setActionId(`warn-${student._id}`);
    setNotice(null);

    try {
      const { data } = await api.post(
        `/activity/${student._id}/warn`,
        {
          message:
            'Teacher warning: remain on the quiz screen and follow the assessment integrity rules.'
        }
      );

      setNotice({
        variant: 'success',
        text: data.message
      });

      await fetchLiveStats();
    } catch (error) {
      setNotice({
        variant: 'danger',
        text: getApiErrorMessage(
          error,
          'The warning could not be sent.'
        )
      });
    } finally {
      setActionId('');
    }
  };

  const restoreQuiz = async (student) => {
    const confirmed = window.confirm(
      `Restore ${student.studentName}'s quiz screen? Their recorded violations will remain in the report.`
    );

    if (!confirmed) {
      return;
    }

    setActionId(`unlock-${student._id}`);
    setNotice(null);

    try {
      const { data } = await api.patch(
        `/activity/${student._id}/unlock`,
        {
          message:
            'Your teacher restored the quiz. Another integrity violation will lock it again.'
        }
      );

      setNotice({
        variant: 'success',
        text: data.message
      });

      await fetchLiveStats();
    } catch (error) {
      setNotice({
        variant: 'danger',
        text: getApiErrorMessage(
          error,
          'The quiz screen could not be restored.'
        )
      });
    } finally {
      setActionId('');
    }
  };

  const loadSubmissionForReview = useCallback(async (submissionId) => {
    const { data } = await api.get(
      `/submissions/${submissionId}`,
      {
        withCredentials: true
      }
    );

    if (!data.success || !data.submission) {
      throw new Error(
        data.message ||
          'Submission details were not found.'
      );
    }

    setSelectedSubmission(data.submission);
    setReviewQuestions(
      normalizeReviewQuestions(data.submission)
    );
    setTeacherFeedback(
      data.submission.teacherFeedback || ''
    );
  }, []);

  const openReview = async (evaluation) => {
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewSaving(false);
    setReviewError('');
    setSelectedSubmission(null);
    setReviewQuestions([]);
    setTeacherFeedback('');

    try {
      await loadSubmissionForReview(evaluation._id);
    } catch (error) {
      setReviewError(
        getApiErrorMessage(
          error,
          'Unable to open this quiz evaluation.'
        )
      );
    } finally {
      setReviewLoading(false);
    }
  };

  const closeReview = () => {
    if (reviewSaving) {
      return;
    }

    setReviewOpen(false);
    setReviewError('');
    setSelectedSubmission(null);
    setReviewQuestions([]);
    setTeacherFeedback('');
  };

  const updateReviewQuestion = (
    questionId,
    field,
    value
  ) => {
    setReviewQuestions((current) =>
      current.map((item) =>
        item.question?._id === questionId
          ? {
              ...item,
              [field]: value
            }
          : item
      )
    );
  };

  const saveReview = async () => {
    if (!selectedSubmission?._id) {
      return;
    }

    for (const item of reviewQuestions) {
      const score = Number(item.teacherScore);
      const maxMarks = Number(item.question?.marks || 0);

      if (
        !Number.isFinite(score) ||
        score < 0 ||
        score > maxMarks
      ) {
        setReviewError(
          `The score for "${
            item.question?.text || 'Question'
          }" must be between 0 and ${maxMarks}.`
        );

        return;
      }
    }

    setReviewSaving(true);
    setReviewError('');

    try {
      await api.put(
        `/submissions/${selectedSubmission._id}/grade`,
        {
          answers: reviewQuestions.map((item) => ({
            questionId: item.question._id,
            teacherScore: Number(item.teacherScore),
            teacherComment: String(
              item.teacherComment || ''
            ).trim()
          })),
          teacherFeedback: String(
            teacherFeedback || ''
          ).trim()
        },
        {
          withCredentials: true
        }
      );

      await loadSubmissionForReview(
        selectedSubmission._id
      );
      await fetchLiveStats();

      setNotice({
        variant: 'success',
        text:
          'The marks were updated successfully and the student was notified.'
      });
    } catch (error) {
      setReviewError(
        getApiErrorMessage(
          error,
          'Unable to save this evaluation.'
        )
      );
    } finally {
      setReviewSaving(false);
    }
  };

  const downloadReport = async () => {
    if (!selectedSubmission?._id) {
      return;
    }

    try {
      const response = await api.get(
        `/submissions/${selectedSubmission._id}/report`,
        {
          responseType: 'blob',
          withCredentials: true
        }
      );

      const url = URL.createObjectURL(
        new Blob([response.data], {
          type: 'application/pdf'
        })
      );

      const link = document.createElement('a');
      link.href = url;
      link.download = `${
        selectedSubmission.quiz?.title || 'quiz'
      }-${
        selectedSubmission.student?.name || 'student'
      }-report.pdf`.replace(
        /[^a-zA-Z0-9-_.]+/g,
        '-'
      );

      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setReviewError(
        getApiErrorMessage(
          error,
          'Unable to download the evaluation report.'
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="empty-panel">
        <Spinner animation="border" />
        <p>Connecting to active quiz sessions...</p>
      </div>
    );
  }

  const shortAnswerCount = reviewQuestions.filter(
    (item) => item.question?.type === 'short'
  ).length;

  const mcqCount = reviewQuestions.filter(
    (item) => item.question?.type === 'mcq'
  ).length;

  return (
    <div className="monitoring-page">
      <Modal
        show={reviewOpen}
        onHide={closeReview}
        size="xl"
        centered
        scrollable
        backdrop="static"
      >
        <Modal.Header closeButton={!reviewSaving}>
          <Modal.Title>
            Review and modify evaluation
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="p-4">
          {reviewLoading ? (
            <div className="empty-panel py-5">
              <Spinner animation="border" />
              <p>Loading the complete quiz evaluation...</p>
            </div>
          ) : reviewError && !selectedSubmission ? (
            <Alert variant="danger" className="mb-0">
              {reviewError}
            </Alert>
          ) : selectedSubmission ? (
            <>
              <div className="page-heading-row mb-4">
                <div>
                  <span className="page-kicker">
                    {selectedSubmission.student?.name || 'Student'}
                    {selectedSubmission.student?.rollNo
                      ? ` · ${selectedSubmission.student.rollNo}`
                      : ''}
                  </span>

                  <h3 className="mb-1">
                    {selectedSubmission.quiz?.title}
                  </h3>

                  <p className="mb-0">
                    The teacher can edit marks and feedback for every MCQ and theoretical question.
                  </p>
                </div>

                <Badge
                  bg={
                    selectedSubmission.overallStatus ===
                    'fully_graded'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {selectedSubmission.overallStatus ===
                  'fully_graded'
                    ? 'Fully graded'
                    : 'Teacher review pending'}
                </Badge>
              </div>

              {reviewError && (
                <Alert variant="danger">
                  {reviewError}
                </Alert>
              )}

              <Row className="g-3 mb-4">
                <Col sm={6} lg={3}>
                  <Card className="h-100 border-0 bg-light">
                    <Card.Body>
                      <small className="text-muted d-block">
                        Current marks
                      </small>
                      <strong className="fs-4">
                        {selectedSubmission.totalScore} /{' '}
                        {selectedSubmission.maxScore}
                      </strong>
                    </Card.Body>
                  </Card>
                </Col>

                <Col sm={6} lg={3}>
                  <Card className="h-100 border-0 bg-light">
                    <Card.Body>
                      <small className="text-muted d-block">
                        Percentage
                      </small>
                      <strong className="fs-4">
                        {Number(
                          selectedSubmission.percentage || 0
                        ).toFixed(1)}
                        %
                      </strong>
                    </Card.Body>
                  </Card>
                </Col>

                <Col sm={6} lg={3}>
                  <Card className="h-100 border-0 bg-light">
                    <Card.Body>
                      <small className="text-muted d-block">
                        MCQs
                      </small>
                      <strong className="fs-4">
                        {mcqCount}
                      </strong>
                    </Card.Body>
                  </Card>
                </Col>

                <Col sm={6} lg={3}>
                  <Card className="h-100 border-0 bg-light">
                    <Card.Body>
                      <small className="text-muted d-block">
                        Theoretical
                      </small>
                      <strong className="fs-4">
                        {shortAnswerCount}
                      </strong>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <div className="d-flex flex-wrap gap-3 mb-4 small text-muted">
                <span>
                  Time used:{' '}
                  <strong>
                    {formatDuration(
                      selectedSubmission.timeTaken
                    )}
                  </strong>
                </span>

                <span>
                  Integrity warnings:{' '}
                  <strong>
                    {selectedSubmission.warnings || 0}
                  </strong>
                </span>

                <span>
                  Evaluation mode:{' '}
                  <strong>
                    {selectedSubmission.quiz?.evaluationMode ===
                    'automatic'
                      ? 'Automatic AI'
                      : 'Teacher review'}
                  </strong>
                </span>
              </div>

              {reviewQuestions.map((item, index) => {
                const question = item.question || {};
                const isShort = question.type === 'short';
                const maxMarks = Number(question.marks || 0);
                const automaticScore = Number(
                  item.finalScore || 0
                );

                return (
                  <Card
                    key={question._id || index}
                    className="mb-4 border-0 shadow-sm"
                  >
                    <Card.Body className="p-4">
                      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                        <div className="flex-grow-1">
                          <span className="page-kicker">
                            Question {index + 1} ·{' '}
                            {isShort
                              ? 'Theoretical answer'
                              : 'Multiple choice'}
                          </span>

                          <h5 className="fw-bold mb-0">
                            {question.text}
                          </h5>
                        </div>

                        <Badge bg="primary">
                          Saved: {automaticScore} / {maxMarks}
                        </Badge>
                      </div>

                      <Row className="g-3">
                        <Col lg={isShort ? 12 : 6}>
                          <div className="p-3 bg-light rounded-3 h-100">
                            <small className="text-muted fw-bold d-block mb-2">
                              Student answer
                            </small>
                            <p className="mb-0">
                              {item.studentAnswer ||
                                'No answer submitted.'}
                            </p>
                          </div>
                        </Col>

                        {!isShort && (
                          <Col lg={6}>
                            <div className="p-3 bg-light rounded-3 h-100">
                              <small className="text-muted fw-bold d-block mb-2">
                                Correct answer
                              </small>
                              <p className="mb-2">
                                {question.correctAnswer ||
                                  'Not available'}
                              </p>

                              <Badge
                                bg={
                                  item.isCorrect
                                    ? 'success'
                                    : 'danger'
                                }
                              >
                                {item.isCorrect
                                  ? 'Automatically marked correct'
                                  : 'Automatically marked incorrect'}
                              </Badge>
                            </div>
                          </Col>
                        )}
                      </Row>

                      {isShort ? (
                        <div className="ai-feedback-box my-3">
                          <FaRobot
                            size={22}
                            className="text-primary mt-1"
                          />

                          <div>
                            <h6 className="fw-bold text-primary mb-1">
                              AI grading suggestion
                            </h6>

                            <p className="mb-1 small">
                              Suggested score:{' '}
                              <strong>
                                {item.aiScore ?? 0} / {maxMarks}
                              </strong>{' '}
                              · Confidence {item.aiConfidence || 0}%
                            </p>

                            <p className="mb-0 small text-muted">
                              {item.aiFeedback ||
                                'No AI feedback available.'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Alert
                          variant="info"
                          className="mt-3 mb-3"
                        >
                          This MCQ was marked automatically, but the teacher can override its marks below.
                        </Alert>
                      )}

                      <Row className="g-3 align-items-end">
                        <Col md={3}>
                          <Form.Label className="fw-bold">
                            Teacher final marks
                          </Form.Label>

                          <div className="d-flex align-items-center gap-2">
                            <Form.Control
                              type="number"
                              min="0"
                              max={maxMarks}
                              step="0.5"
                              value={item.teacherScore}
                              onChange={(event) =>
                                updateReviewQuestion(
                                  question._id,
                                  'teacherScore',
                                  event.target.value
                                )
                              }
                              disabled={reviewSaving}
                            />

                            <strong className="text-nowrap">
                              / {maxMarks}
                            </strong>
                          </div>
                        </Col>

                        <Col md={9}>
                          <Form.Label className="fw-bold">
                            Teacher comment
                          </Form.Label>

                          <Form.Control
                            as="textarea"
                            rows={2}
                            value={item.teacherComment}
                            onChange={(event) =>
                              updateReviewQuestion(
                                question._id,
                                'teacherComment',
                                event.target.value
                              )
                            }
                            placeholder="Explain why these marks were awarded or changed."
                            disabled={reviewSaving}
                          />
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                );
              })}

              <Card className="border-0 bg-light">
                <Card.Body className="p-4">
                  <Form.Label className="fw-bold">
                    Overall feedback for the student
                  </Form.Label>

                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={teacherFeedback}
                    onChange={(event) =>
                      setTeacherFeedback(event.target.value)
                    }
                    placeholder="Add an overall comment about this quiz result."
                    disabled={reviewSaving}
                  />
                </Card.Body>
              </Card>
            </>
          ) : null}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={closeReview}
            disabled={reviewSaving}
          >
            Close
          </Button>

          {selectedSubmission && (
            <>
              <Button
                variant="outline-primary"
                onClick={downloadReport}
                disabled={reviewSaving}
              >
                <FaDownload className="me-2" />
                Download report
              </Button>

              <Button
                onClick={saveReview}
                disabled={reviewSaving}
              >
                {reviewSaving ? (
                  <>
                    <Spinner
                      animation="border"
                      size="sm"
                      className="me-2"
                    />
                    Saving marks...
                  </>
                ) : (
                  <>
                    <FaCheck className="me-2" />
                    Save updated marks
                  </>
                )}
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>

      <div className="page-heading-row">
        <div>
          <span className="page-kicker">
            Real-time activity
          </span>
          <h3>Live monitoring and evaluation</h3>
          <p>
            Detect focus loss, minimized windows, copying attempts, automatic locks, and runtime AI evaluation.
          </p>
        </div>

        <span className="badge bg-success">
          <FaShieldAlt className="me-1" />
          Monitoring enabled
        </span>
      </div>

      {notice && (
        <Alert
          variant={notice.variant}
          dismissible
          onClose={() => setNotice(null)}
        >
          {notice.text}
        </Alert>
      )}

      <Card className="mb-4 overflow-hidden">
        <Card.Body className="p-4 pb-2">
          <div className="page-heading-row mb-2">
            <div>
              <h5 className="section-card-title">
                Runtime evaluations
              </h5>
              <p>
                Submissions received during the last 15 minutes.
              </p>
            </div>

            <Badge bg="primary">
              <FaRobot className="me-1" />
              {recentEvaluations.length} recent
            </Badge>
          </div>
        </Card.Body>

        <Table
          responsive
          hover
          className="mb-0 align-middle"
        >
          <thead>
            <tr>
              <th className="ps-4">Student</th>
              <th>Assessment</th>
              <th>Evaluation mode</th>
              <th>Score</th>
              <th>Status</th>
              <th className="text-end pe-4">Action</th>
            </tr>
          </thead>

          <tbody>
            {recentEvaluations.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-panel m-3">
                    <span className="empty-panel-icon">
                      <FaClipboardCheck />
                    </span>
                    <strong>No recent submissions</strong>
                    <p>
                      AI scores will appear here immediately after submission.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              recentEvaluations.map((evaluation) => (
                <tr key={evaluation._id}>
                  <td className="ps-4">
                    <strong className="text-dark">
                      {evaluation.studentName}
                    </strong>
                    <br />
                    <small className="text-muted">
                      Roll no. {evaluation.rollNo}
                    </small>
                  </td>

                  <td>{evaluation.quizTitle}</td>

                  <td>
                    <Badge
                      bg={
                        evaluation.evaluationMode ===
                        'automatic'
                          ? 'success'
                          : 'warning'
                      }
                    >
                      {evaluation.evaluationMode ===
                      'automatic'
                        ? 'Automatic AI'
                        : 'Teacher approval'}
                    </Badge>
                  </td>

                  <td>
                    <strong>
                      {evaluation.totalScore} /{' '}
                      {evaluation.maxScore}
                    </strong>
                    <br />
                    <small className="text-muted">
                      {evaluation.percentage}%
                    </small>
                  </td>

                  <td>
                    <Badge
                      bg={
                        evaluation.overallStatus ===
                        'fully_graded'
                          ? 'success'
                          : 'warning'
                      }
                    >
                      {evaluation.overallStatus ===
                      'fully_graded'
                        ? 'Evaluated'
                        : 'Review pending'}
                    </Badge>
                  </td>

                  <td className="text-end pe-4">
                    <Button
                      size="sm"
                      onClick={() => openReview(evaluation)}
                    >
                      <FaEye className="me-2" />
                      Review / modify
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <div className="page-heading-row mt-4">
        <div>
          <span className="page-kicker">
            Active attempts
          </span>
          <h5 className="section-card-title">
            Students currently taking a quiz
          </h5>
        </div>

        <Badge bg="secondary">
          {students.length} active
        </Badge>
      </div>

      {students.length === 0 ? (
        <div className="empty-panel">
          <span className="empty-panel-icon">
            <FaDesktop />
          </span>
          <strong>No active sessions</strong>
          <p>
            Students currently taking a quiz will appear here automatically.
          </p>
        </div>
      ) : (
        <Row className="g-4">
          {students.map((student) => {
            const risk = Math.min(
              (student.violations || student.warnings || 0) * 45 +
                (student.lockCount || 0) * 10,
              100
            );

            const locked =
              student.isLocked ||
              student.status === 'locked';

            const warning =
              locked ||
              (student.violations || student.warnings) > 0;

            return (
              <Col
                md={6}
                xl={4}
                key={student._id}
              >
                <Card
                  className={`monitor-card h-100 ${
                    warning ? 'is-warning' : ''
                  } ${locked ? 'is-locked' : ''}`}
                >
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="monitor-student-identity">
                        <Avatar
                          avatar={student.avatar}
                          size="sm"
                          title={`${student.studentName} avatar`}
                        />

                        <div>
                          <h6 className="fw-bold mb-1">
                            {student.studentName}
                          </h6>
                          <span className="text-muted small">
                            Roll no. {student.rollNo}
                          </span>
                        </div>
                      </div>

                      <Badge
                        bg={
                          locked
                            ? 'danger'
                            : warning
                              ? 'warning'
                              : 'success'
                        }
                      >
                        {locked
                          ? 'Quiz locked'
                          : warning
                            ? 'Warning'
                            : 'Active'}
                      </Badge>
                    </div>

                    <div className="p-3 bg-light rounded-3 mb-3">
                      <span className="small text-muted d-block mb-1">
                        {student.quizTitle}
                      </span>
                      <strong className="small text-dark">
                        {student.activity}
                      </strong>
                    </div>

                    <div className="monitor-event-grid">
                      <div>
                        <span>
                          <FaDesktop />
                        </span>
                        <strong>
                          {student.focusLosses ??
                            student.tabSwitches ??
                            0}
                        </strong>
                        <small>Focus / minimize</small>
                      </div>

                      <div>
                        <span>
                          <FaCopy />
                        </span>
                        <strong>
                          {student.copyAttempts || 0}
                        </strong>
                        <small>Copy actions</small>
                      </div>

                      <div>
                        <span>
                          <FaExclamationTriangle />
                        </span>
                        <strong>
                          {student.violations ||
                            student.warnings ||
                            0}
                        </strong>
                        <small>Violations</small>
                      </div>
                    </div>

                    {locked && (
                      <div className="monitor-lock-reason">
                        <FaLock />
                        <div>
                          <small>Locked because</small>
                          <strong>
                            {student.lockReason ||
                              'Second integrity violation'}
                          </strong>
                        </div>
                      </div>
                    )}

                    <div className="d-flex justify-content-between small mb-2 mt-3">
                      <span className="text-muted">
                        Integrity risk
                      </span>
                      <strong>{risk}%</strong>
                    </div>

                    <ProgressBar
                      now={risk}
                      variant={
                        locked
                          ? 'danger'
                          : risk > 0
                            ? 'warning'
                            : 'success'
                      }
                      style={{ height: 7 }}
                    />

                    {student.suspiciousActivity?.length > 0 && (
                      <details className="monitor-activity-details">
                        <summary>
                          Recent detected activity
                        </summary>
                        <ul>
                          {student.suspiciousActivity
                            .slice(0, 3)
                            .map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                        </ul>
                      </details>
                    )}

                    <div className="monitor-actions">
                      <Button
                        variant="light"
                        onClick={() => sendWarning(student)}
                        disabled={Boolean(actionId)}
                      >
                        {actionId ===
                        `warn-${student._id}` ? (
                          <Spinner
                            animation="border"
                            size="sm"
                          />
                        ) : (
                          <FaPaperPlane />
                        )}
                        Send warning
                      </Button>

                      {locked && (
                        <Button
                          variant="success"
                          onClick={() => restoreQuiz(student)}
                          disabled={Boolean(actionId)}
                        >
                          {actionId ===
                          `unlock-${student._id}` ? (
                            <Spinner
                              animation="border"
                              size="sm"
                            />
                          ) : (
                            <FaUnlock />
                          )}
                          Restore quiz
                        </Button>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
};

export default LiveMonitoring;
