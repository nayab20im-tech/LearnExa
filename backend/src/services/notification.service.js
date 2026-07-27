const Notification = require('../models/Notification.model');
const User = require('../models/User.model');
const Submission = require('../models/Submission.model');
const { sendGradeEmail } = require('./email.service');

const buildNotificationActionUrl = (
  type,
  relatedQuiz = null,
  relatedSubmission = null
) => {
  if (
    relatedSubmission &&
    [
      'quiz_graded',
      'feedback_received',
      'feedback',
      'teacher_comment'
    ].includes(type)
  ) {
    return `/results/${relatedSubmission}`;
  }

  if (relatedQuiz && type === 'quiz_published') {
    return `/quiz/${relatedQuiz}/attempt`;
  }

  if (
    [
      'manual_grading_pending',
      'quiz_submitted',
      'ai_grading_completed'
    ].includes(type)
  ) {
    return '/evaluations';
  }

  if (
    type === 'new_user_created' ||
    type === 'account_status_changed'
  ) {
    return '/manage-users';
  }

  return '/dashboard';
};

const getNotificationTitle = (type) => {
  const titles = {
    quiz_published: 'New Quiz Published',
    quiz_graded: 'Quiz Graded',
    feedback_received: 'Feedback Received',
    feedback: 'Feedback Received',
    account_status_changed: 'Account Status Updated',
    new_user_created: 'New User Created',
    quiz_submitted: 'Quiz Submitted',
    ai_grading_completed: 'AI Grading Completed',
    manual_grading_pending: 'Manual Grading Pending',
    teacher_comment: 'Teacher Grade Update',
    general: 'Notification'
  };

  return titles[type] || titles.general;
};

const humanizeStatus = (value) =>
  String(value || 'Fully graded')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const shouldSendGradeEmail = (type, relatedSubmission) =>
  Boolean(
    relatedSubmission &&
      ['quiz_graded', 'teacher_comment'].includes(type)
  );

const emailGradeWithoutFailingNotification = async ({
  recipient,
  type,
  relatedSubmission
}) => {
  if (!shouldSendGradeEmail(type, relatedSubmission)) {
    return;
  }

  try {
    const submission = await Submission.findById(
      relatedSubmission
    )
      .populate('student', 'name email')
      .populate('quiz', 'title totalMarks');

    if (!submission) {
      console.warn(
        `Grade email skipped because submission ${relatedSubmission} was not found.`
      );
      return;
    }

    if (
      submission.student?._id?.toString() !==
      String(recipient)
    ) {
      console.warn(
        'Grade email skipped because the notification recipient does not match the submission student.'
      );
      return;
    }

    /*
     * Send final grades only. This avoids sending repeated emails
     * while a teacher is still reviewing several short answers.
     */
    if (submission.overallStatus !== 'fully_graded') {
      return;
    }

    const clientUrl = (
      process.env.CLIENT_URL ||
      'http://localhost:5173'
    ).replace(/\/+$/, '');

    const result = await sendGradeEmail({
      to: submission.student?.email,
      studentName:
        submission.student?.name || 'Student',
      quizTitle:
        submission.quiz?.title || 'Assessment',
      marksObtained:
        submission.totalScore ?? 0,
      totalMarks:
        submission.maxScore ??
        submission.quiz?.totalMarks ??
        0,
      percentage:
        submission.percentage ?? 0,
      status: humanizeStatus(
        submission.overallStatus
      ),
      teacherFeedback:
        submission.teacherFeedback || '',
      resultUrl: `${clientUrl}/results/${submission._id}`
    });

    if (result.sent) {
      console.log(
        `Grade email sent to ${submission.student?.email}`
      );
    }
  } catch (error) {
    /*
     * A mail-provider problem must never stop grading or the
     * in-app notification from being saved.
     */
    console.error(
      'Grade email could not be sent:',
      error.message
    );
  }
};

/**
 * Creates one notification for a user.
 */
const createNotification = async (
  recipient,
  message,
  type,
  relatedQuiz = null,
  title = null,
  relatedSubmission = null
) => {
  try {
    const notification = new Notification({
      recipient,
      title: title || getNotificationTitle(type),
      message,
      type,
      relatedQuiz,
      relatedSubmission,
      actionUrl: buildNotificationActionUrl(
        type,
        relatedQuiz,
        relatedSubmission
      ),
      isRead: false
    });

    await notification.save();

    try {
      await User.findByIdAndUpdate(recipient, {
        $inc: {
          notificationCount: 1
        }
      });
    } catch (error) {
      console.error(
        'Error incrementing user notification count:',
        error.message
      );
    }

    await emailGradeWithoutFailingNotification({
      recipient,
      type,
      relatedSubmission
    });

    return notification;
  } catch (error) {
    console.error(
      'Error creating notification:',
      error.message
    );
    throw error;
  }
};

/**
 * Creates notifications for many students.
 */
const notifyManyStudents = async (
  studentIds,
  message,
  type,
  relatedQuiz = null,
  title = null
) => {
  try {
    if (!studentIds || studentIds.length === 0) {
      return;
    }

    const notifications = studentIds.map(
      (studentId) => ({
        recipient: studentId,
        title: title || getNotificationTitle(type),
        message,
        type,
        relatedQuiz,
        actionUrl: buildNotificationActionUrl(
          type,
          relatedQuiz,
          null
        ),
        isRead: false
      })
    );

    const inserted = await Notification.insertMany(
      notifications
    );

    try {
      await User.updateMany(
        {
          _id: {
            $in: studentIds
          }
        },
        {
          $inc: {
            notificationCount: 1
          }
        }
      );
    } catch (error) {
      console.error(
        'Error incrementing user notification counts:',
        error.message
      );
    }

    console.log(
      `Created ${inserted.length} notifications for ${studentIds.length} recipients`
    );
  } catch (error) {
    console.error(
      'Error creating bulk notifications:',
      error.message
    );
  }
};

module.exports = {
  createNotification,
  notifyManyStudents,
  getNotificationTitle,
  buildNotificationActionUrl
};
