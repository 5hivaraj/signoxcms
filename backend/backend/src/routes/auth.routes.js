const express = require('express');
const router = express.Router();

const { login, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.post('/login', login);
router.get('/me', requireAuth, me);

module.exports = router;
