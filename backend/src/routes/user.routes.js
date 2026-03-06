const express = require('express');
const router = express.Router();

const { createUser, listUsers, deleteUser, bulkDeleteUsers, getUserProfile, getUserProfileSettings, updateProfile, updatePassword, resetUserPassword, getAccountInfo } = require('../controllers/user.controller');
const { requireAuth, requireSuperAdmin, requireAnyAdmin } = require('../middleware/auth.middleware');
const {
  createClientAdmin,
  listClientAdmins,
  toggleClientAdminStatus,
  updateClientAdmin,
  deleteClientAdmin,
} = require('../controllers/client.controller');

// Hierarchical user management
router.post('/', requireAuth, requireAnyAdmin, createUser);
router.get('/', requireAuth, requireAnyAdmin, listUsers);
router.delete('/:id', requireAuth, requireAnyAdmin, deleteUser);
router.post('/bulk-delete', requireAuth, requireAnyAdmin, bulkDeleteUsers);

// Profile management
router.get('/profile', requireAuth, getUserProfile);
router.get('/profile/settings', requireAuth, getUserProfileSettings);
router.put('/profile', requireAuth, updateProfile);
router.put('/profile/password', requireAuth, updatePassword);
router.put('/:id/reset-password', requireAuth, requireAnyAdmin, resetUserPassword);
router.get('/me/account', requireAuth, getAccountInfo);

// Super Admin Client Management
router.post('/client-admin', requireAuth, requireSuperAdmin, createClientAdmin);
router.get('/client-admins', requireAuth, requireSuperAdmin, listClientAdmins);
router.put('/client-admins/:id', requireAuth, requireSuperAdmin, updateClientAdmin);
router.patch('/client-admins/:id/status', requireAuth, requireSuperAdmin, toggleClientAdminStatus);
router.delete('/client-admins/:id', requireAuth, requireSuperAdmin, deleteClientAdmin);

module.exports = router;
