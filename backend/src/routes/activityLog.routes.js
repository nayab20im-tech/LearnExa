const express = require('express');
const router = express.Router();
const {
  startQuizSession,
  updateQuizSession,
  getQuizSessionStatus,
  sendTeacherWarning,
  unlockQuizSession,
  endQuizSession,
  getLiveMonitoring,
} = require('../controllers/activityLog.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.use(protect);

router.post('/start', requireRole('Student'), startQuizSession);
router.put('/update', requireRole('Student'), updateQuizSession);
router.get('/status/:quizId', requireRole('Student'), getQuizSessionStatus);
router.post('/end', requireRole('Student'), endQuizSession);

router.get('/live', requireRole('Teacher', 'Admin'), getLiveMonitoring);
router.post('/:logId/warn', requireRole('Teacher', 'Admin'), sendTeacherWarning);
router.patch('/:logId/unlock', requireRole('Teacher', 'Admin'), unlockQuizSession);

module.exports = router;
