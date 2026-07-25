const User = require('../models/User.model');
const { serializeUser } = require('../utils/auth');

const allowedAvatarValues = {
  background: new Set(['lagoon', 'sunrise', 'sky', 'mint', 'berry', 'midnight']),
  skinTone: new Set(['porcelain', 'peach', 'golden', 'caramel', 'cocoa', 'deep']),
  hairStyle: new Set(['short', 'waves', 'curly', 'bun', 'hijab']),
  hairColor: new Set(['espresso', 'chocolate', 'auburn', 'black', 'honey', 'teal']),
  outfit: new Set(['hoodie', 'sweater', 'jacket', 'uniform']),
  outfitColor: new Set(['teal', 'orange', 'blue', 'coral', 'navy', 'mint']),
  accessory: new Set(['none', 'glasses', 'round-glasses', 'cap', 'headphones']),
  expression: new Set(['smile', 'happy', 'calm'])
};

const sanitizeAvatar = (avatar = {}) => {
  const clean = {};
  Object.entries(allowedAvatarValues).forEach(([field, allowed]) => {
    if (typeof avatar[field] === 'string' && allowed.has(avatar[field])) {
      clean[field] = avatar[field];
    }
  });
  return clean;
};

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }
    return res.status(200).json({ success: true, user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      user.name = req.body.name.trim().slice(0, 100);
    }
    if (typeof req.body.department === 'string') {
      user.department = req.body.department.trim().slice(0, 100);
    }
    if (user.role === 'Student' && typeof req.body.rollNo === 'string' && req.body.rollNo.trim()) {
      user.rollNo = req.body.rollNo.trim().slice(0, 60);
    }
    if (req.body.avatar && typeof req.body.avatar === 'object') {
      const safeAvatar = sanitizeAvatar(req.body.avatar);
      if (!user.avatar) user.avatar = {};
      Object.entries(safeAvatar).forEach(([key, value]) => {
        user.avatar[key] = value;
      });
      user.avatar.customized = true;
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: serializeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getProfile, updateProfile };
