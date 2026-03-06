const express = require('express');
const router = express.Router();
const displayController = require('../controllers/display.controller');
const { 
  requireAuth, 
  requireDisplayManagement,
} = require('../middleware/auth.middleware');

// POST /api/displays/pairing-code
// Generate a new 6-digit pairing code (PUBLIC - for player devices)
router.post('/pairing-code', displayController.generatePairingCode);

// POST /api/displays/check-status
// Check if a display has been paired (PUBLIC - for player devices)
router.post('/check-status', displayController.checkPairingStatus);

// POST /api/displays/pair
// Pair a display with a User Admin
// Accessible by: Super Admin, Client Admin, User Admin
router.post('/pair', requireAuth, displayController.pairDisplay);

// GET /api/displays
// Get all displays (filtered by user role)
// Accessible by: All authenticated users (with role-based filtering)
router.get('/', requireAuth, displayController.getDisplays);

// GET /api/displays/:id/status
// Get display status (PUBLIC - for player devices)
// Must come before /:id route to avoid conflicts
router.get('/:id/status', displayController.getDisplayStatus);

// GET /api/displays/:id
// Get a specific display
// Accessible by: All authenticated users (with access control)
router.get('/:id', requireAuth, displayController.getDisplay);

// PATCH /api/displays/:id
// Update a display (assign playlist, layout, update name, etc.)
// Accessible by: Super Admin, Client Admin, User Admin, Staff (Broadcast Manager)
router.patch('/:id', requireAuth, displayController.updateDisplay);

// DELETE /api/displays/:id
// Delete a display
// Accessible by: Super Admin, Client Admin only
// Note: Permission check is done in controller
router.delete('/:id', requireAuth, displayController.deleteDisplay);

// POST /api/displays/:id/heartbeat
// Update display heartbeat (called by the device)
// Accessible by: Device token authentication
router.post('/:id/heartbeat', displayController.updateHeartbeat);

module.exports = router;
