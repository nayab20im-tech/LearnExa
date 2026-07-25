const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      default: null,
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      default: null,
    },
    loginTime: {
      type: Date,
      default: null,
    },
    logoutTime: {
      type: Date,
      default: null,
    },
    sessionDuration: {
      type: Number,
      default: null,
      comment: 'In seconds',
    },

    // Backward-compatible focus-loss counter. This includes a hidden tab,
    // a minimized browser window, or the quiz window losing focus.
    tabSwitchCount: {
      type: Number,
      default: 0,
    },
    focusLossCount: {
      type: Number,
      default: 0,
    },
    copyAttemptCount: {
      type: Number,
      default: 0,
    },
    violationCount: {
      type: Number,
      default: 0,
    },
    warnings: {
      type: Number,
      default: 0,
    },
    lockCount: {
      type: Number,
      default: 0,
    },
    suspiciousActivity: {
      type: [String],
      default: [],
    },

    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    isQuizSession: {
      type: Boolean,
      default: false,
    },

    monitoringStatus: {
      type: String,
      enum: ['active', 'warning', 'critical', 'locked', 'disconnected', 'completed'],
      default: 'active',
    },
    currentActivity: {
      type: String,
      default: 'Idle',
    },
    lastHeartbeat: {
      type: Date,
      default: null,
    },

    // Server-authoritative lock state. Students cannot restore this state.
    isLocked: {
      type: Boolean,
      default: false,
    },
    lockReason: {
      type: String,
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    unlockedAt: {
      type: Date,
      default: null,
    },
    unlockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Teacher messages are pulled by the student status poll.
    lastTeacherWarning: {
      type: String,
      default: null,
    },
    teacherWarningAt: {
      type: Date,
      default: null,
    },
    teacherWarningSequence: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

activityLogSchema.index({ userId: 1 });
activityLogSchema.index({ submissionId: 1 });
activityLogSchema.index({ quizId: 1 });
activityLogSchema.index({ loginTime: -1 });
activityLogSchema.index({ monitoringStatus: 1 });
activityLogSchema.index({ quizId: 1, userId: 1, createdAt: -1 });
activityLogSchema.index({ isLocked: 1, updatedAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
