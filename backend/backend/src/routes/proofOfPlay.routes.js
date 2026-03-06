const express = require('express');
const router = express.Router();
const { getProofOfPlay } = require('../controllers/proofOfPlay.controller');
const { requireAuth } = require('../middleware/auth.middleware');

/**
 * GET /api/proof-of-play
 * Get proof of play data
 * Accessible by: USER_ADMIN, POP_MANAGER (and their parent roles)
 */
router.get('/', requireAuth, getProofOfPlay);

module.exports = router;
