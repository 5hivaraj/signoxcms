const express = require('express');
const router = express.Router();
const playerController = require('../controllers/player.controller');

// Player config (requires deviceToken in Authorization header)
router.get('/config', playerController.getConfig);

// Debug endpoint to check schedule status
router.get('/debug', playerController.getDebugInfo);

module.exports = router;