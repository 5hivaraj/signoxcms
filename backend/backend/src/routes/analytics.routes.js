const express = require('express');
const router = express.Router();

const { getSummary } = require('../controllers/analytics.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// All authenticated admin roles can hit this; controller branches by role.
router.get('/summary', requireAuth, getSummary);

module.exports = router;

