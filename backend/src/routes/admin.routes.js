const express = require('express');
const router = express.Router();

const { requireAuth, requireSuperAdmin } = require('../middleware/auth.middleware');
const cleanupService = require('../services/cleanup.service');

// Manual cleanup trigger (Super Admin only)
router.post('/cleanup/media', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const results = await cleanupService.runCleanup();
    
    res.json({
      message: 'Manual cleanup completed',
      results: {
        deleted: results.deleted,
        errors: results.errors,
      },
    });
  } catch (error) {
    console.error('Manual cleanup failed:', error);
    res.status(500).json({
      message: 'Cleanup failed',
      error: error.message,
    });
  }
});

// Get cleanup service status (Super Admin only)
router.get('/cleanup/status', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const status = cleanupService.getStatus();
    res.json({
      service: 'Media Cleanup Service',
      ...status,
    });
  } catch (error) {
    console.error('Failed to get cleanup status:', error);
    res.status(500).json({
      message: 'Failed to get cleanup status',
      error: error.message,
    });
  }
});

module.exports = router;