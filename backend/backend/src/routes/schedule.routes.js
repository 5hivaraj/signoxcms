const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

// All schedule routes require authentication
router.use(requireAuth);

// GET /api/schedules - Get all schedules
router.get('/', scheduleController.getSchedules);

// GET /api/schedules/active - Get currently active schedules
router.get('/active', scheduleController.getActiveSchedules);

// POST /api/schedules - Create new schedule
// Allow USER_ADMIN, CLIENT_ADMIN, SUPER_ADMIN, and STAFF with BROADCAST_MANAGER / CONTENT_MANAGER / DISPLAY_MANAGER
router.post('/', (req, res, next) => {
  const user = req.user;
  const allowedRoles = ['USER_ADMIN', 'CLIENT_ADMIN', 'SUPER_ADMIN'];
  const allowedStaffRoles = ['BROADCAST_MANAGER', 'CONTENT_MANAGER', 'DISPLAY_MANAGER'];
  
  if (allowedRoles.includes(user.role) || 
      (user.role === 'STAFF' && user.staffRole && allowedStaffRoles.includes(user.staffRole))) {
    next();
  } else {
    return res.status(403).json({ 
      message: 'Forbidden: insufficient rights to create schedules',
      required: `One of: ${allowedRoles.join(', ')} or STAFF with role: ${allowedStaffRoles.join(', ')}`,
      current: user.role === 'STAFF' ? `${user.role} (${user.staffRole || 'none'})` : user.role
    });
  }
}, scheduleController.createSchedule);

// PUT /api/schedules/:id - Update schedule
router.put('/:id', scheduleController.updateSchedule);

// DELETE /api/schedules/:id - Delete schedule
router.delete('/:id', scheduleController.deleteSchedule);

module.exports = router;