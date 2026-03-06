const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class AuditService {
  constructor() {
    this.auditLogFile = path.join(logsDir, 'audit.log');
  }

  // Log user actions
  async logUserAction(action, details, req) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action,
      userId: req.user ? req.user.id : null,
      userEmail: req.user ? req.user.email : null,
      userRole: req.user ? req.user.role : null,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      endpoint: `${req.method} ${req.path}`,
      details,
      sessionId: req.sessionID || null
    };

    // Write to audit log file
    const logLine = JSON.stringify(auditEntry) + '\n';
    fs.appendFileSync(this.auditLogFile, logLine);

    // Also store in database for queryable audit trail
    try {
      // Note: You might want to create an AuditLog model in your Prisma schema
      // For now, we'll just log to file
      console.log(`📋 Audit: ${action} by ${auditEntry.userEmail || 'anonymous'}`);
    } catch (error) {
      console.error('❌ Failed to store audit log in database:', error);
    }
  }

  // Log data changes
  async logDataChange(entity, entityId, action, oldData, newData, req) {
    const changes = this.calculateChanges(oldData, newData);
    
    await this.logUserAction(`${entity.toUpperCase()}_${action.toUpperCase()}`, {
      entityType: entity,
      entityId,
      changes,
      oldData: action === 'DELETE' ? oldData : undefined,
      newData: action === 'CREATE' ? newData : undefined
    }, req);
  }

  // Calculate what changed between old and new data
  calculateChanges(oldData, newData) {
    if (!oldData || !newData) return null;

    const changes = {};
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    for (const key of allKeys) {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          from: oldData[key],
          to: newData[key]
        };
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }

  // Log authentication events
  async logAuthEvent(event, details, req) {
    await this.logUserAction(`AUTH_${event.toUpperCase()}`, details, req);
  }

  // Log security events
  async logSecurityEvent(event, details, req) {
    await this.logUserAction(`SECURITY_${event.toUpperCase()}`, details, req);
  }

  // Log system events
  async logSystemEvent(event, details) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: `SYSTEM_${event.toUpperCase()}`,
      userId: null,
      userEmail: 'system',
      userRole: 'system',
      ip: 'localhost',
      userAgent: 'system',
      endpoint: 'system',
      details,
      sessionId: null
    };

    const logLine = JSON.stringify(auditEntry) + '\n';
    fs.appendFileSync(this.auditLogFile, logLine);
    
    console.log(`🔧 System: ${event}`);
  }

  // Get audit logs with filtering
  async getAuditLogs(filters = {}) {
    try {
      const logs = fs.readFileSync(this.auditLogFile, 'utf8')
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .reverse(); // Most recent first

      let filteredLogs = logs;

      // Apply filters
      if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
      }

      if (filters.action) {
        filteredLogs = filteredLogs.filter(log => 
          log.action.toLowerCase().includes(filters.action.toLowerCase())
        );
      }

      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) >= new Date(filters.startDate)
        );
      }

      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) <= new Date(filters.endDate)
        );
      }

      if (filters.limit) {
        filteredLogs = filteredLogs.slice(0, parseInt(filters.limit));
      }

      return filteredLogs;
    } catch (error) {
      console.error('❌ Failed to read audit logs:', error);
      return [];
    }
  }

  // Generate audit report
  async generateAuditReport(startDate, endDate) {
    const logs = await this.getAuditLogs({ startDate, endDate });
    
    const report = {
      period: {
        start: startDate,
        end: endDate
      },
      totalEvents: logs.length,
      eventsByAction: {},
      eventsByUser: {},
      eventsByDay: {},
      securityEvents: [],
      dataChanges: []
    };

    logs.forEach(log => {
      // Count by action
      report.eventsByAction[log.action] = (report.eventsByAction[log.action] || 0) + 1;
      
      // Count by user
      const userKey = log.userEmail || 'anonymous';
      report.eventsByUser[userKey] = (report.eventsByUser[userKey] || 0) + 1;
      
      // Count by day
      const day = log.timestamp.split('T')[0];
      report.eventsByDay[day] = (report.eventsByDay[day] || 0) + 1;
      
      // Collect security events
      if (log.action.startsWith('SECURITY_')) {
        report.securityEvents.push(log);
      }
      
      // Collect data changes
      if (log.details && log.details.changes) {
        report.dataChanges.push({
          timestamp: log.timestamp,
          user: log.userEmail,
          entity: log.details.entityType,
          entityId: log.details.entityId,
          changes: log.details.changes
        });
      }
    });

    return report;
  }

  // Clean old audit logs
  async cleanOldLogs(retentionDays = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const logs = fs.readFileSync(this.auditLogFile, 'utf8')
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      const filteredLogs = logs.filter(log => 
        new Date(log.timestamp) > cutoffDate
      );

      const logLines = filteredLogs.map(log => JSON.stringify(log)).join('\n') + '\n';
      fs.writeFileSync(this.auditLogFile, logLines);

      const removedCount = logs.length - filteredLogs.length;
      if (removedCount > 0) {
        console.log(`🧹 Cleaned ${removedCount} old audit log entries`);
      }

      return removedCount;
    } catch (error) {
      console.error('❌ Failed to clean audit logs:', error);
      return 0;
    }
  }
}

module.exports = new AuditService();