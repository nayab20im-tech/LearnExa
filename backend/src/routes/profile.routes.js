const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { getProfile, updateProfile } = require('../controllers/profile.controller');

const router = express.Router();
router.use(protect);
router.get('/', getProfile);
router.patch('/', updateProfile);

module.exports = router;
