const express = require('express');
const router = express.Router();
const { requireAuth, requireSuperAdmin } = require('../middleware/auth.middleware');
const { catchAsync } = require('../middleware/error.middleware');
const healthService = require('../services/health.service');
const backupService = require('../services/backup.service');
const auditService = require('../services/audit.service');

// All monitoring routes require super admin access
router.use(requireAuth);
router.use(requireSuperAdmin);

// Health monitoring endpoints
router.get('/health', catchAsync(async (req, res) => {
  const healthStatus = await healthService.getHealthStatus();
  res.json(healthStatus);
}));

router.get('/health/metrics', catchAsync(async (req, res) => {
  const metrics = healthService.getApplicationMetrics();
  res.json(metrics);
}));

router.post('/health/reset-metrics', catchAsync(async (req, res) => {
  healthService.resetMetrics();
  res.json({ message: 'Metrics reset successfully' });
}));

// Backup management endpoints
router.get('/backups', catchAsync(async (req, res) => {
  const backups = backupService.listBackups();
  res.json({ backups });
}));

router.post('/backups', catchAsync(async (req, res) => {
  const backup = await backupService.createBackup();
  res.json({ 
    message: 'Backup created successfully', 
    backup 
  });
}));

router.post('/backups/:filename/restore', catchAsync(async (req, res) => {
  const { filename } = req.params;
  const result = await backupService.restoreBackup(filename);
  
  // Log the restore operation
  await auditService.logSystemEvent('BACKUP_RESTORE', {
    backupFile: filename,
    restoredBy: req.user.email,
    timestamp: new Date().toISOString()
  });
  
  res.json({ 
    message: 'Database restored successfully', 
    result 
  });
}));

// Audit log endpoints
router.get('/audit-logs', catchAsync(async (req, res) => {
  const filters = {
    userId: req.query.userId,
    action: req.query.action,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    limit: req.query.limit || 100
  };
  
  const logs = await auditService.getAuditLogs(filters);
  res.json({ logs });
}));

router.get('/audit-report', catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ 
      message: 'startDate and endDate are required' 
    });
  }
  
  const report = await auditService.generateAuditReport(startDate, endDate);
  res.json(report);
}));

router.post('/audit-logs/cleanup', catchAsync(async (req, res) => {
  const retentionDays = req.body.retentionDays || 90;
  const removedCount = await auditService.cleanOldLogs(retentionDays);
  
  res.json({ 
    message: `Cleaned ${removedCount} old audit log entries`,
    removedCount 
  });
}));

// System information endpoint
router.get('/system-info', catchAsync(async (req, res) => {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  
  // Get disk usage for uploads directory
  const uploadsDir = path.join(process.cwd(), 'public/uploads');
  let uploadsDirSize = 0;
  
  try {
    const getDirectorySize = (dirPath) => {
      let size = 0;
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          size += getDirectorySize(filePath);
        } else {
          size += stats.size;
        }
      }
      
      return size;
    };
    
    uploadsDirSize = getDirectorySize(uploadsDir);
  } catch (error) {
    console.error('Error calculating uploads directory size:', error);
  }
  
  const systemInfo = {
    server: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: process.uptime(),
      hostname: os.hostname()
    },
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      process: process.memoryUsage()
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model,
      loadAverage: os.loadavg()
    },
    storage: {
      uploadsSize: uploadsDirSize,
      uploadsSizeFormatted: healthService.formatBytes(uploadsDirSize)
    }
  };
  
  res.json(systemInfo);
}));

// Log management endpoints
router.get('/logs/:logType', catchAsync(async (req, res) => {
  const { logType } = req.params;
  const { lines = 100 } = req.query;
  
  const validLogTypes = ['error', 'security', 'audit'];
  if (!validLogTypes.includes(logType)) {
    return res.status(400).json({ 
      message: 'Invalid log type. Valid types: error, security, audit' 
    });
  }
  
  try {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(process.cwd(), 'logs', `${logType}.log`);
    
    if (!fs.existsSync(logFile)) {
      return res.json({ logs: [], message: 'Log file not found' });
    }
    
    const logContent = fs.readFileSync(logFile, 'utf8');
    const logLines = logContent.split('\n')
      .filter(line => line.trim())
      .slice(-parseInt(lines))
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line, timestamp: null };
        }
      });
    
    res.json({ logs: logLines });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to read log file', 
      error: error.message 
    });
  }
}));

module.exports = router;