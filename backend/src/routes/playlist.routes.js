const express = require('express');
const router = express.Router();

const {
  createPlaylist,
  getPlaylist,
  listPlaylists,
  updatePlaylist,
  deletePlaylist,
} = require('../controllers/playlist.controller');

const { requireAuth } = require('../middleware/auth.middleware');

// Role rules:
// - USER_ADMIN & STAFF(BROADCAST_MANAGER): full access
// - STAFF(CONTENT_MANAGER): view-only
// - STAFF(DISPLAY_MANAGER): no access
const requirePlaylistRead = (req, res, next) => {
  const u = req.user;
  if (!u) return res.status(401).json({ message: 'Authentication required' });
  if (u.role === 'USER_ADMIN') return next();
  if (u.role === 'STAFF' && (u.staffRole === 'BROADCAST_MANAGER' || u.staffRole === 'CONTENT_MANAGER')) return next();
  return res.status(403).json({ message: 'Forbidden' });
};

const requirePlaylistWrite = (req, res, next) => {
  const u = req.user;
  if (!u) return res.status(401).json({ message: 'Authentication required' });
  if (u.role === 'USER_ADMIN') return next();
  if (u.role === 'STAFF' && u.staffRole === 'BROADCAST_MANAGER') return next();
  return res.status(403).json({ message: 'Forbidden' });
};

router.get('/', requireAuth, requirePlaylistRead, listPlaylists);
router.get('/:id', requireAuth, requirePlaylistRead, getPlaylist);
router.post('/', requireAuth, requirePlaylistWrite, createPlaylist);
router.put('/:id', requireAuth, requirePlaylistWrite, updatePlaylist);
router.delete('/:id', requireAuth, requirePlaylistWrite, deletePlaylist);

module.exports = router;