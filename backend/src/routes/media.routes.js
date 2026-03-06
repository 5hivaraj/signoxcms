const express = require('express');
const router = express.Router();

const { createMedia, listMedia, deleteMedia, updateMedia, getStorageInfo } = require('../controllers/media.controller');
const { requireAuth, requireContentManagement, requireContentViewAccess } = require('../middleware/auth.middleware');
const { cacheMedia, invalidateMediaCache } = require('../middleware/cache.middleware');
const { auditFileOperation } = require('../middleware/audit.middleware');
const upload = require('../middleware/upload.middleware');

// USER_ADMIN + STAFF (CONTENT_MANAGER/BROADCAST_MANAGER) can upload & delete
router.post('/', requireAuth, requireContentManagement, upload.single('file'), auditFileOperation('UPLOAD'), invalidateMediaCache, createMedia);
router.put('/:id', requireAuth, requireContentManagement, auditFileOperation('UPDATE'), invalidateMediaCache, updateMedia);
router.delete('/:id', requireAuth, requireContentManagement, auditFileOperation('DELETE'), invalidateMediaCache, deleteMedia);

// Media library list - allows CMS_VIEWER read-only access with caching
router.get('/', requireAuth, requireContentViewAccess, cacheMedia, listMedia);

// Storage information endpoint - allows CMS_VIEWER read-only access with short cache
router.get('/storage-info', requireAuth, requireContentViewAccess, getStorageInfo);

module.exports = router;
