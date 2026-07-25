const ActivityLog = require('../models/ActivityLog.model');
const Submission = require('../models/Submission.model');
const Quiz = require('../models/Quiz.model');

const INCIDENT_LABELS = {
  focus_loss: 'Quiz tab changed, browser minimized, or quiz window lost focus',
  copy_attempt: 'Copying quiz content was attempted',
  cut_attempt: 'Cutting quiz content was attempted',
  context_menu: 'Context menu was opened inside the quiz',
};

const normalizeMessage = (value, fallback) => {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, 240);
};

const serializeSession = (log) => ({
  _id: log._id,
  quizId: log.quizId,
  loginTime: log.loginTime || null,
  userId: log.userId,
  tabSwitchCount: log.tabSwitchCount || 0,
  focusLossCount: log.focusLossCount || 0,
  copyAttemptCount: log.copyAttemptCount || 0,
  violationCount: log.violationCount || 0,
  warnings: log.warnings || 0,
  lockCount: log.lockCount || 0,
  isLocked: Boolean(log.isLocked),
  lockReason: log.lockReason || null,
  monitoringStatus: log.monitoringStatus,
  currentActivity: log.currentActivity,
  lastTeacherWarning: log.lastTeacherWarning || null,
  teacherWarningAt: log.teacherWarningAt || null,
  teacherWarningSequence: log.teacherWarningSequence || 0,
  suspiciousActivity: log.suspiciousActivity || [],
  updatedAt: log.updatedAt,
});

const getLatestStudentSession = (userId, quizId) => ActivityLog.findOne({
  userId,
  quizId,
  isQuizSession: true,
  monitoringStatus: { $ne: 'completed' },
}).sort({ createdAt: -1 });

const teacherCanManageLog = async (log, user) => {
  if (user.role === 'Admin') return true;
  const quiz = await Quiz.findById(log.quizId).select('createdBy');
  return Boolean(quiz && quiz.createdBy?.toString() === user.id);
};

/**
 * @desc    Start or restore a quiz proctoring session
 * @route   POST /api/activity/start
 * @access  Private/Student
 */
const startQuizSession = async (req, res, next) => {
  try {
    const { quizId, submissionId } = req.body;

    if (!quizId) {
      return res.status(400).json({ success: false, message: 'Quiz ID is required' });
    }

    // Reuse an unfinished session after refresh. This also prevents duplicate
    // live-monitoring cards for the same student and assessment.
    let log = await getLatestStudentSession(req.user.id, quizId);

    if (log) {
      log.lastHeartbeat = new Date();
      if (!log.isLocked) {
        log.monitoringStatus = log.violationCount > 0 ? 'warning' : 'active';
        log.currentActivity = 'Quiz session restored';
      }
      if (submissionId && !log.submissionId) log.submissionId = submissionId;
      await log.save();

      return res.status(200).json({
        success: true,
        message: 'Existing proctoring session restored',
        restored: true,
        log: serializeSession(log),
      });
    }

    log = new ActivityLog({
      userId: req.user.id,
      quizId,
      submissionId: submissionId || null,
      loginTime: new Date(),
      lastHeartbeat: new Date(),
      isQuizSession: true,
      monitoringStatus: 'active',
      currentActivity: 'Started Quiz',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null,
    });

    await log.save();

    return res.status(201).json({
      success: true,
      message: 'Proctoring session started',
      restored: false,
      log: serializeSession(log),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Record a proctoring event or heartbeat
 * @route   PUT /api/activity/update
 * @access  Private/Student
 */
const updateQuizSession = async (req, res, next) => {
  try {
    const {
      quizId,
      eventType,
      incidentLabel,
      currentActivity,
      tabSwitchCount,
      warnings,
      suspiciousActivity,
      monitoringStatus,
    } = req.body;

    if (!quizId) {
      return res.status(400).json({ success: false, message: 'Quiz ID is required' });
    }

    const log = await getLatestStudentSession(req.user.id, quizId);

    if (!log) {
      return res.status(404).json({ success: false, message: 'Active proctoring log not found' });
    }

    if (eventType === 'heartbeat') {
      log.lastHeartbeat = new Date();
      if (!log.isLocked && currentActivity) {
        log.currentActivity = normalizeMessage(currentActivity, 'Working on quiz');
      }
      await log.save();
      return res.status(200).json({ success: true, action: 'heartbeat', log: serializeSession(log) });
    }

    if (log.isLocked) {
      return res.status(423).json({
        success: false,
        action: 'locked',
        message: 'The quiz is locked. Only the teacher can restore access.',
        log: serializeSession(log),
      });
    }

    if (INCIDENT_LABELS[eventType]) {
      const label = normalizeMessage(incidentLabel, INCIDENT_LABELS[eventType]);
      const recordedAt = new Date();

      log.violationCount = (Number(log.violationCount) || 0) + 1;
      log.warnings = log.violationCount;
      log.focusLossCount = Number(log.focusLossCount) || 0;
      log.tabSwitchCount = Number(log.tabSwitchCount) || 0;
      log.copyAttemptCount = Number(log.copyAttemptCount) || 0;
      log.lockCount = Number(log.lockCount) || 0;
      log.lastHeartbeat = recordedAt;

      if (eventType === 'focus_loss') {
        log.focusLossCount += 1;
        log.tabSwitchCount = log.focusLossCount;
      }
      if (eventType === 'copy_attempt' || eventType === 'cut_attempt' || eventType === 'context_menu') {
        log.copyAttemptCount += 1;
      }

      log.suspiciousActivity.push(`${label} · ${recordedAt.toISOString()}`);
      // Keep the document bounded during long sessions.
      if (log.suspiciousActivity.length > 100) {
        log.suspiciousActivity = log.suspiciousActivity.slice(-100);
      }

      let action = 'warning';
      let message = 'Automatic warning: remain on the quiz and do not copy assessment content.';

      if (log.violationCount === 1) {
        log.monitoringStatus = 'warning';
        log.currentActivity = `Automatic warning issued: ${label}`;
      } else {
        action = 'locked';
        message = 'Quiz access has been locked after a second integrity violation.';
        log.isLocked = true;
        log.lockCount += 1;
        log.lockReason = label;
        log.lockedAt = recordedAt;
        log.monitoringStatus = 'locked';
        log.currentActivity = `Quiz locked: ${label}`;
      }

      await log.save();

      if (log.submissionId) {
        await Submission.findByIdAndUpdate(log.submissionId, {
          $set: {
            tabSwitchCount: log.tabSwitchCount,
            focusLossCount: log.focusLossCount,
            copyAttemptCount: log.copyAttemptCount,
            warnings: log.warnings,
            lockCount: log.lockCount,
          },
          $addToSet: { suspiciousFlags: label },
        });
      }

      return res.status(200).json({
        success: true,
        action,
        message,
        log: serializeSession(log),
      });
    }

    // Backward-compatible update support for older clients.
    if (tabSwitchCount !== undefined) log.tabSwitchCount = Number(tabSwitchCount) || 0;
    if (warnings !== undefined) log.warnings = Number(warnings) || 0;
    if (monitoringStatus) log.monitoringStatus = monitoringStatus;
    if (currentActivity) log.currentActivity = normalizeMessage(currentActivity, 'Quiz activity updated');
    if (suspiciousActivity) log.suspiciousActivity.push(normalizeMessage(suspiciousActivity, 'Suspicious activity'));
    log.lastHeartbeat = new Date();
    await log.save();

    return res.status(200).json({ success: true, action: 'updated', log: serializeSession(log) });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Read current proctoring state (student poll)
 * @route   GET /api/activity/status/:quizId
 * @access  Private/Student
 */
const getQuizSessionStatus = async (req, res, next) => {
  try {
    const log = await getLatestStudentSession(req.user.id, req.params.quizId);

    if (!log) {
      return res.status(404).json({ success: false, message: 'Active proctoring session not found' });
    }

    return res.status(200).json({ success: true, log: serializeSession(log) });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Send a teacher warning to an active student session
 * @route   POST /api/activity/:logId/warn
 * @access  Private/Teacher/Admin
 */
const sendTeacherWarning = async (req, res, next) => {
  try {
    const log = await ActivityLog.findById(req.params.logId);
    if (!log) return res.status(404).json({ success: false, message: 'Monitoring session not found' });

    if (!(await teacherCanManageLog(log, req.user))) {
      return res.status(403).json({ success: false, message: 'You cannot manage this quiz session.' });
    }

    const warningMessage = normalizeMessage(
      req.body.message,
      'Teacher warning: remain focused on the quiz window and follow assessment rules.'
    );

    log.lastTeacherWarning = warningMessage;
    log.teacherWarningAt = new Date();
    log.teacherWarningSequence += 1;
    log.currentActivity = 'Teacher warning sent';
    if (!log.isLocked) log.monitoringStatus = 'warning';
    await log.save();

    return res.status(200).json({
      success: true,
      message: 'Warning sent to the student.',
      log: serializeSession(log),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Restore a locked quiz screen
 * @route   PATCH /api/activity/:logId/unlock
 * @access  Private/Teacher/Admin
 */
const unlockQuizSession = async (req, res, next) => {
  try {
    const log = await ActivityLog.findById(req.params.logId);
    if (!log) return res.status(404).json({ success: false, message: 'Monitoring session not found' });

    if (!(await teacherCanManageLog(log, req.user))) {
      return res.status(403).json({ success: false, message: 'You cannot manage this quiz session.' });
    }

    if (!log.isLocked) {
      return res.status(200).json({
        success: true,
        message: 'This quiz screen is already available.',
        log: serializeSession(log),
      });
    }

    log.isLocked = false;
    log.unlockedAt = new Date();
    log.unlockedBy = req.user.id;
    log.monitoringStatus = 'warning';
    log.currentActivity = 'Quiz access restored by teacher';
    log.lastTeacherWarning = normalizeMessage(
      req.body.message,
      'Your teacher restored the quiz. Another integrity violation will lock it again.'
    );
    log.teacherWarningAt = new Date();
    log.teacherWarningSequence += 1;
    await log.save();

    return res.status(200).json({
      success: true,
      message: 'Quiz access restored for the student.',
      log: serializeSession(log),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    End a proctoring session
 * @route   POST /api/activity/end
 * @access  Private/Student
 */
const endQuizSession = async (req, res, next) => {
  try {
    const { quizId } = req.body;
    const log = await getLatestStudentSession(req.user.id, quizId);

    if (!log) {
      return res.status(404).json({ success: false, message: 'Active proctoring log not found' });
    }

    log.logoutTime = new Date();
    log.monitoringStatus = 'completed';
    log.currentActivity = 'Quiz Submitted';
    log.isLocked = false;

    if (log.loginTime) {
      log.sessionDuration = Math.round((log.logoutTime.getTime() - log.loginTime.getTime()) / 1000);
    }

    await log.save();

    return res.status(200).json({ success: true, message: 'Proctoring session ended', log: serializeSession(log) });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get live monitoring data
 * @route   GET /api/activity/live
 * @access  Private/Teacher/Admin
 */
const getLiveMonitoring = async (req, res, next) => {
  try {
    const quizFilter = req.user.role === 'Admin' ? {} : { createdBy: req.user.id };
    const teacherQuizzes = await Quiz.find(quizFilter).select('_id title evaluationMode');
    const quizIds = teacherQuizzes.map((quiz) => quiz._id);
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    const logs = await ActivityLog.find({
      quizId: { $in: quizIds },
      isQuizSession: true,
      updatedAt: { $gte: fifteenMinsAgo },
      monitoringStatus: { $ne: 'completed' },
    })
      .populate('userId', 'name rollNo department avatar')
      .populate('quizId', 'title totalMarks evaluationMode')
      .sort({ updatedAt: -1 });

    // Only the newest unfinished log per student/quiz is shown.
    const uniqueLogs = [];
    const seen = new Set();
    for (const log of logs) {
      const key = `${log.userId?._id || log.userId}:${log.quizId?._id || log.quizId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueLogs.push(log);
    }

    const liveData = uniqueLogs.map((log) => ({
      _id: log._id,
      studentId: log.userId?._id || null,
      studentName: log.userId?.name || 'Unknown Student',
      rollNo: log.userId?.rollNo || 'N/A',
      department: log.userId?.department || 'N/A',
      avatar: log.userId?.avatar || null,
      quizId: log.quizId?._id || null,
      quizTitle: log.quizId?.title || 'Deleted Assessment',
      evaluationMode: log.quizId?.evaluationMode || 'teacher_review',
      warnings: log.warnings || 0,
      violations: log.violationCount || 0,
      tabSwitches: log.tabSwitchCount || 0,
      focusLosses: log.focusLossCount || 0,
      copyAttempts: log.copyAttemptCount || 0,
      lockCount: log.lockCount || 0,
      isLocked: Boolean(log.isLocked),
      lockReason: log.lockReason || null,
      suspiciousActivity: (log.suspiciousActivity || []).slice(-6).reverse(),
      status: log.monitoringStatus,
      activity: log.currentActivity,
      lastUpdated: log.updatedAt,
    }));

    const recentEvaluations = await Submission.find({
      quiz: { $in: quizIds },
      submittedAt: { $gte: fifteenMinsAgo },
    })
      .populate('student', 'name rollNo')
      .populate('quiz', 'title evaluationMode totalMarks')
      .sort({ submittedAt: -1 })
      .limit(20);

    const evaluationData = recentEvaluations.map((submission) => ({
      _id: submission._id,
      studentName: submission.student?.name || 'Unknown Student',
      rollNo: submission.student?.rollNo || 'N/A',
      quizTitle: submission.quiz?.title || 'Deleted Assessment',
      evaluationMode: submission.quiz?.evaluationMode || 'teacher_review',
      totalScore: submission.totalScore ?? 0,
      maxScore: submission.maxScore ?? submission.quiz?.totalMarks ?? 0,
      percentage: submission.percentage ?? 0,
      overallStatus: submission.overallStatus,
      submittedAt: submission.submittedAt,
      aiEvaluatedAnswers: (submission.answers || []).filter(
        (answer) => answer.questionType === 'short' && answer.aiScore !== null
      ).length,
      teacherOverrides: (submission.answers || []).filter(
        (answer) => answer.questionType === 'short' && answer.teacherScore !== null
      ).length,
    }));

    return res.status(200).json({
      success: true,
      count: liveData.length,
      liveData,
      recentEvaluations: evaluationData,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  startQuizSession,
  updateQuizSession,
  getQuizSessionStatus,
  sendTeacherWarning,
  unlockQuizSession,
  endQuizSession,
  getLiveMonitoring,
};
