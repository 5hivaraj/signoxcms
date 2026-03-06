const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_PATH || path.join(__dirname, '../../backups');
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
    this.isEnabled = process.env.BACKUP_ENABLED === 'true';
    this.schedule = process.env.BACKUP_INTERVAL || '0 2 * * *'; // Daily at 2 AM
    
    this.ensureBackupDirectory();
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${this.backupDir}`);
    }
  }

  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `signox-backup-${timestamp}`;
      const backupPath = path.join(this.backupDir, backupName);

      console.log(`🔄 Starting database backup: ${backupName}`);

      // Extract MongoDB connection details from DATABASE_URL
      const dbUrl = process.env.DATABASE_URL;
      const urlParts = dbUrl.match(/mongodb:\/\/([^:]+):(\d+)\/(.+)/);
      
      if (!urlParts) {
        throw new Error('Invalid DATABASE_URL format');
      }

      const [, host, port, dbName] = urlParts;

      // Create mongodump command
      const dumpCommand = `mongodump --host ${host}:${port} --db ${dbName} --out "${backupPath}"`;

      return new Promise((resolve, reject) => {
        exec(dumpCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Backup failed: ${error.message}`);
            reject(error);
            return;
          }

          // Compress the backup
          const tarCommand = `tar -czf "${backupPath}.tar.gz" -C "${this.backupDir}" "${backupName}"`;
          
          exec(tarCommand, (tarError) => {
            if (tarError) {
              console.error(`❌ Backup compression failed: ${tarError.message}`);
              reject(tarError);
              return;
            }

            // Remove uncompressed backup directory
            exec(`rm -rf "${backupPath}"`, () => {
              const backupSize = this.getFileSize(`${backupPath}.tar.gz`);
              console.log(`✅ Backup completed: ${backupName}.tar.gz (${backupSize})`);
              
              // Clean old backups
              this.cleanOldBackups();
              
              resolve({
                name: `${backupName}.tar.gz`,
                path: `${backupPath}.tar.gz`,
                size: backupSize,
                timestamp: new Date()
              });
            });
          });
        });
      });
    } catch (error) {
      console.error('❌ Backup service error:', error);
      throw error;
    }
  }

  async restoreBackup(backupFileName) {
    try {
      const backupPath = path.join(this.backupDir, backupFileName);
      
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupFileName}`);
      }

      console.log(`🔄 Starting database restore from: ${backupFileName}`);

      // Extract backup
      const extractPath = backupPath.replace('.tar.gz', '');
      const extractCommand = `tar -xzf "${backupPath}" -C "${this.backupDir}"`;

      return new Promise((resolve, reject) => {
        exec(extractCommand, (extractError) => {
          if (extractError) {
            console.error(`❌ Backup extraction failed: ${extractError.message}`);
            reject(extractError);
            return;
          }

          // Get database details
          const dbUrl = process.env.DATABASE_URL;
          const urlParts = dbUrl.match(/mongodb:\/\/([^:]+):(\d+)\/(.+)/);
          
          if (!urlParts) {
            reject(new Error('Invalid DATABASE_URL format'));
            return;
          }

          const [, host, port, dbName] = urlParts;
          const restoreCommand = `mongorestore --host ${host}:${port} --db ${dbName} --drop "${extractPath}/signox"`;

          exec(restoreCommand, (restoreError, stdout, stderr) => {
            // Clean up extracted files
            exec(`rm -rf "${extractPath}"`, () => {
              if (restoreError) {
                console.error(`❌ Database restore failed: ${restoreError.message}`);
                reject(restoreError);
                return;
              }

              console.log(`✅ Database restored from: ${backupFileName}`);
              resolve({
                backupFile: backupFileName,
                restoredAt: new Date()
              });
            });
          });
        });
      });
    } catch (error) {
      console.error('❌ Restore service error:', error);
      throw error;
    }
  }

  cleanOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backupFiles = files.filter(file => file.startsWith('signox-backup-') && file.endsWith('.tar.gz'));
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      let deletedCount = 0;
      
      backupFiles.forEach(file => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️ Deleted old backup: ${file}`);
        }
      });

      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old backup(s)`);
      }
    } catch (error) {
      console.error('❌ Backup cleanup error:', error);
    }
  }

  listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backupFiles = files
        .filter(file => file.startsWith('signox-backup-') && file.endsWith('.tar.gz'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: this.getFileSize(filePath),
            created: stats.mtime,
            path: filePath
          };
        })
        .sort((a, b) => b.created - a.created);

      return backupFiles;
    } catch (error) {
      console.error('❌ List backups error:', error);
      return [];
    }
  }

  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const bytes = stats.size;
      
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (error) {
      return 'Unknown';
    }
  }

  start() {
    if (!this.isEnabled) {
      console.log('📦 Backup service disabled');
      return;
    }

    console.log(`📦 Backup service started - Schedule: ${this.schedule}`);
    console.log(`📁 Backup directory: ${this.backupDir}`);
    console.log(`🗓️ Retention period: ${this.retentionDays} days`);

    // Schedule automatic backups
    cron.schedule(this.schedule, async () => {
      console.log('⏰ Scheduled backup starting...');
      try {
        await this.createBackup();
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error);
      }
    });

    // Create initial backup if none exist
    const existingBackups = this.listBackups();
    if (existingBackups.length === 0) {
      console.log('📦 No existing backups found, creating initial backup...');
      setTimeout(async () => {
        try {
          await this.createBackup();
        } catch (error) {
          console.error('❌ Initial backup failed:', error);
        }
      }, 5000); // Wait 5 seconds after startup
    }
  }

  stop() {
    console.log('📦 Backup service stopped');
  }
}

module.exports = new BackupService();