import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Modal,
  ProgressBar,
  Row,
  Spinner
} from 'react-bootstrap';
import {
  FaArrowLeft,
  FaArrowRight,
  FaBan,
  FaCheck,
  FaClock,
  FaCopy,
  FaExclamationTriangle,
  FaFlag,
  FaKey,
  FaLock,
  FaRegFlag,
  FaShieldAlt,
  FaTimes
} from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import api, { API_ORIGIN, getApiErrorMessage } from '../api/client';

const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

const QuizAttempt = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startedAt, setStartedAt] = useState(null);

  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [focusLossCount, setFocusLossCount] = useState(0);
  const [copyAttemptCount, setCopyAttemptCount] = useState(0);
  const [violations, setViolations] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [lockCount, setLockCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [incidentFlags, setIncidentFlags] = useState([]);
  const [warningDialog, setWarningDialog] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const submissionStarted = useRef(false);
  const lockedRef = useRef(false);
  const lastIncidentRef = useRef({});
  const likelyMinimizeRef = useRef(false);
  const teacherWarningSequenceRef = useRef(0);

  const applySessionState = useCallback(
    (log, { showTeacherMessage = false } = {}) => {
      if (!log) {
        return;
      }

      setTabSwitchCount(Number(log.tabSwitchCount) || 0);

      setFocusLossCount(
        Number(log.focusLossCount) ||
          Number(log.tabSwitchCount) ||
          0
      );

      setCopyAttemptCount(
        Number(log.copyAttemptCount) || 0
      );

      setViolations(
        Number(log.violationCount) ||
          Number(log.warnings) ||
          0
      );

      setWarnings(
        Number(log.warnings) ||
          Number(log.violationCount) ||
          0
      );

      setLockCount(Number(log.lockCount) || 0);

      setIncidentFlags(
        Array.isArray(log.suspiciousActivity)
          ? log.suspiciousActivity
          : []
      );

      const locked = Boolean(log.isLocked);

      lockedRef.current = locked;
      setIsLocked(locked);

      setLockReason(
        log.lockReason ||
          'The proctoring system locked this quiz.'
      );

      const warningSequence =
        Number(log.teacherWarningSequence) || 0;

      if (
        showTeacherMessage &&
        warningSequence >
          teacherWarningSequenceRef.current &&
        log.lastTeacherWarning
      ) {
        setWarningDialog({
          type: 'teacher',
          title: locked
            ? 'Teacher message'
            : 'Message from your teacher',
          message: log.lastTeacherWarning
        });
      }

      teacherWarningSequenceRef.current = Math.max(
        teacherWarningSequenceRef.current,
        warningSequence
      );
    },
    []
  );

  const openQuizWithCode = useCallback(
    async (codeValue) => {
      const normalizedCode = String(
        codeValue || ''
      )
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

      if (!normalizedCode) {
        setError(
          'Enter the access code shared by your teacher.'
        );
        return;
      }

      setVerifyingCode(true);
      setLoading(true);
      setSessionReady(false);

      submissionStarted.current = false;

      setError('');

      try {
        const { data } = await api.post(
          `/quizzes/${quizId}/access`,
          {
            accessCode: normalizedCode
          }
        );

        if (!data.success || !data.quiz) {
          throw new Error(
            data.message ||
              'The quiz could not be opened.'
          );
        }

        const loadedQuiz = data.quiz;

        const loadedQuestions = Array.isArray(
          loadedQuiz.questions
        )
          ? loadedQuiz.questions
          : [];

        let restoredAnswers = {};

        const savedAnswers =
          sessionStorage.getItem(
            `learnexa-quiz-answers-${quizId}`
          );

        if (savedAnswers) {
          try {
            restoredAnswers =
              JSON.parse(savedAnswers);
          } catch {
            sessionStorage.removeItem(
              `learnexa-quiz-answers-${quizId}`
            );
          }
        }

        /*
         * Start the monitoring session and initialize
         * the timer before displaying the quiz.
         *
         * sessionReady remains false while these values
         * are being prepared. Therefore, timeLeft = 0
         * cannot automatically submit the quiz.
         */
        const sessionResponse = await api.post(
          '/activity/start',
          {
            quizId
          }
        );

        const sessionLog =
          sessionResponse.data?.log;

        const sessionStart =
          sessionLog?.loginTime ||
          new Date().toISOString();

        const parsedStart =
          new Date(sessionStart).getTime();

        const safeStart = Number.isFinite(
          parsedStart
        )
          ? parsedStart
          : Date.now();

        const durationSeconds =
          Math.max(
            1,
            Number(loadedQuiz.timeLimit) || 1
          ) * 60;

        const elapsedSeconds = Math.max(
          0,
          Math.floor(
            (Date.now() - safeStart) / 1000
          )
        );

        const initialTimeLeft = Math.max(
          durationSeconds - elapsedSeconds,
          0
        );

        setAccessCode(normalizedCode);

        sessionStorage.setItem(
          `learnexa-quiz-code-${quizId}`,
          normalizedCode
        );

        setAnswers(restoredAnswers);

        setStartedAt(
          new Date(safeStart).toISOString()
        );

        setTimeLeft(initialTimeLeft);
        setCurrentQ(0);

        applySessionState(sessionLog, {
          showTeacherMessage: true
        });

        setQuestions(loadedQuestions);
        setQuiz(loadedQuiz);

        /*
         * Keep this as the final state update.
         * The timer and submission effects activate only
         * after everything above has been initialized.
         */
        setSessionReady(true);
      } catch (requestError) {
        sessionStorage.removeItem(
          `learnexa-quiz-code-${quizId}`
        );

        setSessionReady(false);
        setQuiz(null);
        setQuestions([]);
        setStartedAt(null);
        setTimeLeft(0);

        setError(
          getApiErrorMessage(
            requestError,
            'The access code could not be verified.'
          )
        );
      } finally {
        setLoading(false);
        setVerifyingCode(false);
      }
    },
    [applySessionState, quizId]
  );

  useEffect(() => {
    const savedCode =
      sessionStorage.getItem(
        `learnexa-quiz-code-${quizId}`
      );

    if (savedCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openQuizWithCode(savedCode);
    } else {
      setLoading(false);
    }
  }, [openQuizWithCode, quizId]);

  const reportIncident = useCallback(
    async (eventType, incidentLabel) => {
      if (
        !sessionReady ||
        !quiz ||
        submitting ||
        lockedRef.current
      ) {
        return;
      }

      const now = Date.now();
      const previousAt = Number(
        lastIncidentRef.current[eventType] || 0
      );

      if (now - previousAt < 1600) {
        return;
      }

      lastIncidentRef.current[eventType] = now;

      try {
        const token = localStorage.getItem('token');

        const response = await fetch(
          `${API_ORIGIN}/api/activity/update`,
          {
            method: 'PUT',
            credentials: 'include',
            keepalive: [
              'tab_switch',
              'window_minimize',
              'focus_loss'
            ].includes(eventType),
            headers: {
              'Content-Type': 'application/json',
              ...(token
                ? {
                    Authorization: `Bearer ${token}`
                  }
                : {})
            },
            body: JSON.stringify({
              quizId,
              eventType,
              incidentLabel
            })
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (
          response.status === 423 &&
          data.log
        ) {
          applySessionState(data.log);
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.message ||
              `Unable to record proctoring activity. Status: ${response.status}`
          );
        }

        applySessionState(data.log);

        if (data.action === 'warning') {
          setWarningDialog({
            type: 'automatic',
            title: 'Automatic integrity warning',
            message:
              data.message ||
              `${incidentLabel} was detected. A second violation will lock the quiz until your teacher restores it.`
          });
        }

        if (data.action === 'locked') {
          lockedRef.current = true;
          setIsLocked(true);
          setLockReason(
            data.log?.lockReason ||
              incidentLabel
          );
          setWarningDialog(null);
        }
      } catch (requestError) {
        console.error(
          'Unable to record proctoring incident:',
          requestError
        );
      }
    },
    [
      applySessionState,
      quiz,
      quizId,
      sessionReady,
      submitting
    ]
  );

  useEffect(() => {
    if (
      !sessionReady ||
      !quiz ||
      submitting
    ) {
      return undefined;
    }

    let blurTimer;

    const browserLooksMinimized = () =>
      document.hidden &&
      (
        window.outerWidth <= 160 ||
        window.outerHeight <= 160 ||
        window.screenX <= -30000 ||
        window.screenY <= -30000
      );

    const recordHiddenWindow = () => {
      if (!document.hidden || lockedRef.current) {
        return;
      }

      window.clearTimeout(blurTimer);

      const minimized =
        likelyMinimizeRef.current ||
        browserLooksMinimized();

      likelyMinimizeRef.current = false;

      if (minimized) {
        reportIncident(
          'window_minimize',
          'Browser window was minimized'
        );
        return;
      }

      reportIncident(
        'tab_switch',
        'Quiz tab was switched or hidden'
      );
    };

    const recordWindowBlur = () => {
      window.clearTimeout(blurTimer);

      blurTimer = window.setTimeout(() => {
        if (
          !document.hidden &&
          !lockedRef.current
        ) {
          reportIncident(
            'focus_loss',
            'Quiz window lost focus to another window or application'
          );
        }
      }, 500);
    };

    const recordWindowResize = () => {
      if (browserLooksMinimized()) {
        likelyMinimizeRef.current = true;
      }
    };

    const recordKeyboardShortcut = (event) => {
      const key = String(event.key || '').toLowerCase();

      if (
        (event.ctrlKey || event.metaKey) &&
        ['tab', 'pageup', 'pagedown'].includes(key)
      ) {
        reportIncident(
          'tab_switch',
          'A keyboard shortcut was used to switch browser tabs'
        );
      }

      if (event.altKey && key === 'tab') {
        reportIncident(
          'focus_loss',
          'An application-switch shortcut was used'
        );
      }
    };

    const preventCopy = (event) => {
      event.preventDefault();
      reportIncident(
        'copy_attempt',
        'Copying text from the quiz was attempted'
      );
    };

    const preventCut = (event) => {
      event.preventDefault();
      reportIncident(
        'cut_attempt',
        'Cutting text from the quiz was attempted'
      );
    };

    const preventContextMenu = (event) => {
      event.preventDefault();
      reportIncident(
        'context_menu',
        'The context menu was opened inside the quiz'
      );
    };

    document.addEventListener(
      'visibilitychange',
      recordHiddenWindow
    );
    window.addEventListener(
      'blur',
      recordWindowBlur
    );
    window.addEventListener(
      'resize',
      recordWindowResize
    );
    document.addEventListener(
      'keydown',
      recordKeyboardShortcut,
      true
    );
    document.addEventListener(
      'copy',
      preventCopy
    );
    document.addEventListener(
      'cut',
      preventCut
    );
    document.addEventListener(
      'contextmenu',
      preventContextMenu
    );

    return () => {
      window.clearTimeout(blurTimer);

      document.removeEventListener(
        'visibilitychange',
        recordHiddenWindow
      );
      window.removeEventListener(
        'blur',
        recordWindowBlur
      );
      window.removeEventListener(
        'resize',
        recordWindowResize
      );
      document.removeEventListener(
        'keydown',
        recordKeyboardShortcut,
        true
      );
      document.removeEventListener(
        'copy',
        preventCopy
      );
      document.removeEventListener(
        'cut',
        preventCut
      );
      document.removeEventListener(
        'contextmenu',
        preventContextMenu
      );
    };
  }, [
    quiz,
    reportIncident,
    sessionReady,
    submitting
  ]);

  useEffect(() => {
    if (
      !sessionReady ||
      !quiz ||
      submitting
    ) {
      return undefined;
    }

    const syncStatus = async () => {
      try {
        const { data } = await api.get(
          `/activity/status/${quizId}`
        );

        const wasLocked =
          lockedRef.current;

        applySessionState(data.log, {
          showTeacherMessage: true
        });

        if (
          wasLocked &&
          !data.log?.isLocked
        ) {
          setWarningDialog({
            type: 'restored',
            title: 'Quiz access restored',
            message:
              data.log?.lastTeacherWarning ||
              'Your teacher restored this quiz. Remain on the assessment screen; another violation will lock it again.'
          });
        }
      } catch {
        // Polling retries automatically.
      }
    };

    syncStatus();

    const interval =
      window.setInterval(
        syncStatus,
        5000
      );

    return () =>
      window.clearInterval(interval);
  }, [
    applySessionState,
    quiz,
    quizId,
    sessionReady,
    submitting
  ]);

  useEffect(() => {
    if (
      !sessionReady ||
      !quiz ||
      submitting ||
      isLocked
    ) {
      return undefined;
    }

    const heartbeat = () => {
      api
        .put('/activity/update', {
          quizId,
          eventType: 'heartbeat',
          currentActivity:
            `Answering question ${currentQ + 1} of ${questions.length}`
        })
        .catch(() => {});
    };

    heartbeat();

    const interval =
      window.setInterval(
        heartbeat,
        10000
      );

    return () =>
      window.clearInterval(interval);
  }, [
    currentQ,
    isLocked,
    questions.length,
    quiz,
    quizId,
    sessionReady,
    submitting
  ]);

  useEffect(() => {
    if (!sessionReady || !quiz) {
      return;
    }

    sessionStorage.setItem(
      `learnexa-quiz-answers-${quizId}`,
      JSON.stringify(answers)
    );
  }, [
    answers,
    quiz,
    quizId,
    sessionReady
  ]);

  const answeredCount = useMemo(
    () =>
      questions.filter((question) =>
        String(
          answers[question._id] || ''
        ).trim()
      ).length,
    [answers, questions]
  );

  const progress = questions.length
    ? Math.round(
        (answeredCount /
          questions.length) *
          100
      )
    : 0;

  const formattedTime = useMemo(() => {
    const safeTime = Number.isFinite(
      timeLeft
    )
      ? Math.max(timeLeft, 0)
      : 0;

    const minutes = Math.floor(
      safeTime / 60
    )
      .toString()
      .padStart(2, '0');

    const seconds = (
      safeTime % 60
    )
      .toString()
      .padStart(2, '0');

    return `${minutes}:${seconds}`;
  }, [timeLeft]);

  const submitQuiz = useCallback(
    async (forced = false) => {
      if (
        submissionStarted.current ||
        !sessionReady ||
        !quiz ||
        questions.length === 0 ||
        lockedRef.current
      ) {
        return;
      }

      const unanswered =
        questions.length -
        answeredCount;

      if (
        !forced &&
        unanswered > 0 &&
        !window.confirm(
          `${unanswered} question(s) are unanswered. Submit anyway?`
        )
      ) {
        return;
      }

      submissionStarted.current = true;

      setSubmitting(true);
      setError('');

      try {
        const elapsedSeconds = startedAt
          ? Math.max(
              0,
              Math.round(
                (
                  Date.now() -
                  new Date(
                    startedAt
                  ).getTime()
                ) / 1000
              )
            )
          : 0;

        const payload = {
          quizId,
          accessCode,
          startedAt,
          timeTaken: elapsedSeconds,
          tabSwitchCount,
          focusLossCount,
          copyAttemptCount,
          lockCount,
          warnings,
          suspiciousFlags:
            incidentFlags,

          answers: questions.map(
            (question) => ({
              questionId:
                question._id,

              answer: String(
                answers[
                  question._id
                ] || ''
              ).trim()
            })
          )
        };

        const { data } =
          await api.post(
            '/submissions',
            payload
          );

        await api
          .post('/activity/end', {
            quizId
          })
          .catch(() => {});

        sessionStorage.removeItem(
          `learnexa-quiz-code-${quizId}`
        );

        sessionStorage.removeItem(
          `learnexa-quiz-answers-${quizId}`
        );

        navigate(
          `/results/${data.submission._id}`,
          {
            replace: true
          }
        );
      } catch (requestError) {
        if (
          requestError.response
            ?.status === 423
        ) {
          setIsLocked(true);

          lockedRef.current = true;

          setLockReason(
            requestError.response
              ?.data?.message ||
              'Quiz access is locked.'
          );
        } else {
          setError(
            getApiErrorMessage(
              requestError,
              'Unable to submit this quiz.'
            )
          );
        }

        submissionStarted.current = false;
        setSubmitting(false);
      }
    },
    [
      accessCode,
      answeredCount,
      answers,
      copyAttemptCount,
      focusLossCount,
      incidentFlags,
      lockCount,
      navigate,
      questions,
      quiz,
      quizId,
      sessionReady,
      startedAt,
      tabSwitchCount,
      warnings
    ]
  );

  useEffect(() => {
    /*
     * Do not start or automatically submit until the
     * access code, questions, monitoring session,
     * start time and initial timer are ready.
     */
    if (
      !sessionReady ||
      !quiz ||
      submitting
    ) {
      return undefined;
    }

    if (timeLeft <= 0) {
      const submitTimer =
        window.setTimeout(
          () => submitQuiz(true),
          0
        );

      return () =>
        window.clearTimeout(
          submitTimer
        );
    }

    const timer =
      window.setTimeout(() => {
        setTimeLeft((previous) =>
          Math.max(
            previous - 1,
            0
          )
        );
      }, 1000);

    return () =>
      window.clearTimeout(timer);
  }, [
    quiz,
    sessionReady,
    submitQuiz,
    submitting,
    timeLeft
  ]);

  const toggleFlag = () => {
    setFlagged((items) =>
      items.includes(currentQ)
        ? items.filter(
            (item) =>
              item !== currentQ
          )
        : [...items, currentQ]
    );
  };

  if (loading) {
    return (
      <div className="empty-panel">
        <Spinner animation="border" />

        <p>
          {verifyingCode
            ? 'Verifying quiz access code...'
            : 'Preparing your quiz...'}
        </p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Card
          className="border-0 shadow-sm rounded-4"
          style={{
            maxWidth: 520,
            width: '100%'
          }}
        >
          <Card.Body className="p-4 p-md-5 text-center">
            <span
              className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-10 text-primary mb-3"
              style={{
                width: 64,
                height: 64
              }}
            >
              <FaKey size={26} />
            </span>

            <h3 className="fw-bold">
              Enter quiz access code
            </h3>

            <p className="text-muted">
              Only students who received
              the code from the teacher can
              open this assessment.
            </p>

            {error && (
              <Alert variant="danger">
                {error}
              </Alert>
            )}

            <Form
              onSubmit={(event) => {
                event.preventDefault();

                openQuizWithCode(
                  accessCode
                );
              }}
            >
              <Form.Control
                value={accessCode}
                onChange={(event) =>
                  setAccessCode(
                    event.target.value
                      .toUpperCase()
                      .replace(
                        /[^A-Z0-9]/g,
                        ''
                      )
                      .slice(0, 12)
                  )
                }
                placeholder="e.g. A7K9P2XZ"
                className="text-center font-monospace fw-bold fs-4 mb-3"
                style={{
                  letterSpacing: '0.16em'
                }}
                autoFocus
                disabled={verifyingCode}
              />

              <Button
                type="submit"
                className="w-100"
                disabled={
                  verifyingCode ||
                  !accessCode.trim()
                }
              >
                {verifyingCode ? (
                  <>
                    <Spinner
                      animation="border"
                      size="sm"
                      className="me-2"
                    />

                    Verifying...
                  </>
                ) : (
                  <>
                    <FaKey className="me-2" />

                    Open quiz
                  </>
                )}
              </Button>
            </Form>

            <Button
              variant="link"
              className="mt-3"
              onClick={() =>
                navigate('/dashboard')
              }
            >
              Back to dashboard
            </Button>
          </Card.Body>
        </Card>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="proctor-lock-screen animate-entrance">
        <div
          className="proctor-lock-orbit"
          aria-hidden="true"
        />

        <Card className="proctor-lock-card border-0">
          <Card.Body className="p-4 p-md-5 text-center">
            <span className="proctor-lock-icon">
              <FaLock />
            </span>

            <span className="page-kicker">
              Assessment protection
            </span>

            <h2>Quiz screen locked</h2>

            <p>
              The system detected a second
              integrity violation and has
              hidden all quiz content. Only
              your teacher can restore this
              assessment.
            </p>

            <div className="proctor-lock-reason">
              <FaExclamationTriangle />

              <div>
                <small>
                  Latest detected activity
                </small>

                <strong>
                  {lockReason}
                </strong>
              </div>
            </div>

            <div className="proctor-lock-stats">
              <span>
                <b>{focusLossCount}</b>{' '}
                focus losses
              </span>

              <span>
                <b>{copyAttemptCount}</b>{' '}
                copy actions
              </span>

              <span>
                <b>{violations}</b>{' '}
                violations
              </span>
            </div>

            <div className="proctor-waiting-line">
              <Spinner
                animation="grow"
                size="sm"
              />

              Waiting for teacher
              authorization. This screen
              checks automatically.
            </div>

            <Button
              variant="outline-secondary"
              onClick={() =>
                navigate('/dashboard')
              }
            >
              Return to student dashboard
            </Button>
          </Card.Body>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="empty-panel">
        <strong>
          This quiz has no questions.
        </strong>

        <Button
          onClick={() =>
            navigate('/dashboard')
          }
        >
          Back to dashboard
        </Button>
      </div>
    );
  }

  const question =
    questions[currentQ];

  return (
    <div className="quiz-attempt-page animate-entrance quiz-copy-protected">
      <Modal
        show={Boolean(warningDialog)}
        onHide={() =>
          setWarningDialog(null)
        }
        centered
        backdrop="static"
        keyboard={false}
        dialogClassName="integrity-warning-modal"
      >
        <Modal.Body className="p-4 p-md-5 text-center">
          <span
            className={`integrity-warning-icon is-${
              warningDialog?.type ||
              'automatic'
            }`}
          >
            {warningDialog?.type ===
            'restored' ? (
              <FaShieldAlt />
            ) : (
              <FaExclamationTriangle />
            )}
          </span>

          <span className="page-kicker">
            {warningDialog?.type ===
            'teacher'
              ? 'Teacher notice'
              : 'Secure assessment'}
          </span>

          <h3>
            {warningDialog?.title}
          </h3>

          <p>
            {warningDialog?.message}
          </p>

          {warningDialog?.type ===
            'automatic' && (
            <div className="integrity-policy-summary">
              <span>
                <FaBan />

                Do not leave or minimize
                the quiz
              </span>

              <span>
                <FaCopy />

                Do not copy quiz content
              </span>
            </div>
          )}

          <Button
            onClick={() =>
              setWarningDialog(null)
            }
          >
            I understand — continue quiz
          </Button>
        </Modal.Body>
      </Modal>

      <div className="quiz-session-bar">
        <div className="quiz-session-title">
          <span className="quiz-course-icon">
            {(
              quiz.subject?.code ||
              quiz.category ||
              'QZ'
            )
              .slice(0, 2)
              .toUpperCase()}
          </span>

          <div>
            <span className="page-kicker">
              {quiz.subject?.name ||
                quiz.category}
            </span>

            <h3>{quiz.title}</h3>
          </div>
        </div>

        <div className="quiz-proctor-pill">
          <FaShieldAlt />

          <div>
            <small>Proctoring</small>

            <strong>
              {violations === 0
                ? 'Secure'
                : `${violations} warning${
                    violations === 1
                      ? ''
                      : 's'
                  }`}
            </strong>
          </div>
        </div>

        <div
          className={`quiz-timer ${
            timeLeft < 300
              ? 'is-low'
              : ''
          }`}
        >
          <FaClock />

          <div>
            <small>
              Time remaining
            </small>

            <strong>
              {formattedTime}
            </strong>
          </div>
        </div>
      </div>

      {error && (
        <Alert
          variant="danger"
          className="mb-4"
        >
          {error}
        </Alert>
      )}

      {violations > 0 && (
        <Alert
          variant="warning"
          className="mb-4 integrity-inline-alert"
        >
          <FaExclamationTriangle />

          <div>
            <strong>
              {violations} integrity
              event
              {violations === 1
                ? ''
                : 's'}{' '}
              recorded
            </strong>

            <span>
              {focusLossCount} focus
              loss · {copyAttemptCount}{' '}
              copy-related action
              {copyAttemptCount === 1
                ? ''
                : 's'}
            </span>
          </div>
        </Alert>
      )}

      <Row className="g-4">
        <Col xl={8}>
          <Card className="quiz-question-card h-100">
            <Card.Body className="p-4 p-lg-5 d-flex flex-column">
              <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
                <div>
                  <span className="question-counter">
                    Question{' '}
                    {currentQ + 1} of{' '}
                    {questions.length}
                  </span>

                  <span className="question-type-badge">
                    {question.type ===
                    'mcq'
                      ? 'Multiple choice'
                      : 'Short answer'}
                  </span>
                </div>

                <button
                  type="button"
                  className={`flag-question-button ${
                    flagged.includes(
                      currentQ
                    )
                      ? 'active'
                      : ''
                  }`}
                  onClick={toggleFlag}
                >
                  {flagged.includes(
                    currentQ
                  ) ? (
                    <FaFlag />
                  ) : (
                    <FaRegFlag />
                  )}

                  {flagged.includes(
                    currentQ
                  )
                    ? 'Flagged'
                    : 'Flag for review'}
                </button>
              </div>

              <h2 className="quiz-question-text">
                {question.text}
              </h2>

              {question.type ===
              'mcq' ? (
                <div className="quiz-options-list">
                  {(
                    question.options ||
                    []
                  ).map(
                    (
                      option,
                      index
                    ) => {
                      const selected =
                        answers[
                          question._id
                        ] === option;

                      return (
                        <button
                          type="button"
                          key={`${question._id}-${option}`}
                          className={`quiz-answer-option ${
                            selected
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            setAnswers(
                              (
                                current
                              ) => ({
                                ...current,

                                [question._id]:
                                  option
                              })
                            )
                          }
                          disabled={
                            submitting
                          }
                        >
                          <span className="option-letter">
                            {optionLetters[
                              index
                            ] ||
                              index +
                                1}
                          </span>

                          <span>
                            {option}
                          </span>

                          <span className="option-check">
                            {selected && (
                              <FaCheck />
                            )}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              ) : (
                <div className="short-answer-area">
                  <Form.Label>
                    Your answer
                  </Form.Label>

                  <Form.Control
                    as="textarea"
                    rows={7}
                    placeholder="Write a clear and complete explanation..."
                    value={
                      answers[
                        question._id
                      ] || ''
                    }
                    onChange={(
                      event
                    ) =>
                      setAnswers(
                        (
                          current
                        ) => ({
                          ...current,

                          [question._id]:
                            event
                              .target
                              .value
                        })
                      )
                    }
                    disabled={
                      submitting
                    }
                  />

                  {question.hint && (
                    <div className="answer-hint">
                      <span>💡</span>

                      <div>
                        <strong>
                          Helpful hint
                        </strong>

                        <p>
                          {question.hint}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="quiz-question-actions">
                <Button
                  variant="light"
                  disabled={
                    currentQ === 0 ||
                    submitting
                  }
                  onClick={() =>
                    setCurrentQ(
                      (value) =>
                        Math.max(
                          value - 1,
                          0
                        )
                    )
                  }
                >
                  <FaArrowLeft className="me-2" />

                  Previous
                </Button>

                <button
                  type="button"
                  className="clear-answer-button"
                  onClick={() =>
                    setAnswers(
                      (current) => ({
                        ...current,

                        [question._id]:
                          ''
                      })
                    )
                  }
                  disabled={
                    !answers[
                      question._id
                    ] ||
                    submitting
                  }
                >
                  <FaTimes />

                  Clear answer
                </button>

                {currentQ ===
                questions.length -
                  1 ? (
                  <Button
                    onClick={() =>
                      submitQuiz(false)
                    }
                    disabled={
                      submitting
                    }
                  >
                    {submitting ? (
                      <>
                        <Spinner
                          animation="border"
                          size="sm"
                          className="me-2"
                        />

                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit quiz

                        <FaCheck className="ms-2" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      setCurrentQ(
                        (value) =>
                          Math.min(
                            value +
                              1,

                            questions.length -
                              1
                          )
                      )
                    }
                    disabled={
                      submitting
                    }
                  >
                    Next question

                    <FaArrowRight className="ms-2" />
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xl={4}>
          <Card
            className="quiz-navigator-card position-sticky"
            style={{
              top: 105
            }}
          >
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h5 className="section-card-title">
                    Quiz progress
                  </h5>

                  <p className="section-card-subtitle">
                    Answers are kept as
                    you move.
                  </p>
                </div>

                <strong className="progress-percent">
                  {progress}%
                </strong>
              </div>

              <ProgressBar
                now={progress}
                className="mb-4"
                style={{
                  height: 8
                }}
              />

              <div className="question-grid-labels">
                <span>Questions</span>

                <small>
                  Click to jump
                </small>
              </div>

              <div className="question-navigator-grid">
                {questions.map(
                  (item, index) => {
                    const isAnswered =
                      String(
                        answers[
                          item._id
                        ] || ''
                      ).trim()
                        .length > 0;

                    const isFlagged =
                      flagged.includes(
                        index
                      );

                    return (
                      <button
                        type="button"
                        key={item._id}
                        className={`${
                          index ===
                          currentQ
                            ? 'current'
                            : ''
                        } ${
                          isAnswered
                            ? 'answered'
                            : ''
                        } ${
                          isFlagged
                            ? 'flagged'
                            : ''
                        }`}
                        onClick={() =>
                          setCurrentQ(
                            index
                          )
                        }
                        disabled={
                          submitting
                        }
                      >
                        {index + 1}

                        {isFlagged && (
                          <FaFlag />
                        )}
                      </button>
                    );
                  }
                )}
              </div>

              <div className="quiz-legend">
                <span>
                  <i className="legend-current" />

                  Current
                </span>

                <span>
                  <i className="legend-answered" />

                  Answered
                </span>

                <span>
                  <i className="legend-flagged" />

                  Flagged
                </span>
              </div>

              <div className="quiz-summary-box">
                <div>
                  <span>
                    Answered
                  </span>

                  <strong>
                    {answeredCount}
                  </strong>
                </div>

                <div>
                  <span>
                    Remaining
                  </span>

                  <strong>
                    {questions.length -
                      answeredCount}
                  </strong>
                </div>
              </div>

              <div className="quiz-integrity-mini">
                <FaShieldAlt />

                <div>
                  <strong>
                    Integrity monitor
                    active
                  </strong>

                  <span>
                    Leaving,
                    minimizing, or
                    copying is recorded.
                  </span>
                </div>
              </div>

              <Button
                variant="outline-danger"
                className="w-100 mt-3"
                onClick={() =>
                  submitQuiz(false)
                }
                disabled={submitting}
              >
                End and submit quiz
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default QuizAttempt;
