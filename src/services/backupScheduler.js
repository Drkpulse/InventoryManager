const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const db = require('../config/db');

class BackupScheduler {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || '/app/backups';
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 7;
    this.schedulerStarted = false;
  }

  start() {
    if (this.schedulerStarted) return;

    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      // Backup directory created
    }

    // Schedule daily backup at 1:00 AM
    cron.schedule('0 1 * * *', async () => {
      // Starting daily database backup
      try {
        await this.performDatabaseBackup();
        await this.cleanupOldBackups();
        console.log('✅ Daily backup completed successfully');
      } catch (error) {
        console.error('❌ Daily backup failed:', error);
      }
    });

    // Schedule weekly full backup on Sundays at 2:00 AM
    cron.schedule('0 2 * * 0', async () => {
      // Starting weekly full backup
      try {
        await this.performFullBackup();
        console.log('✅ Weekly full backup completed successfully');
      } catch (error) {
        console.error('❌ Weekly backup failed:', error);
      }
    });

    this.schedulerStarted = true;
    console.log('⏰ Database backup scheduler started');
    console.log(`   • Daily backups at 1:00 AM, retention: ${this.retentionDays} days`);
  }

  async performDatabaseBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                     new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
    const backupFile = path.join(this.backupDir, `db_backup_${timestamp}.sql`);

    return new Promise((resolve, reject) => {
      const pgDump = spawn('pg_dump', [
        '-h', process.env.DB_HOST || 'postgres',
        '-U', process.env.DB_USER || 'postgres',
        '-d', process.env.DB_NAME || 'inventory_db',
        '--no-password',
        '--clean',
        '--create',
        '--format=plain'
      ], {
        env: {
          ...process.env,
          PGPASSWORD: process.env.DB_PASSWORD || 'postgres'
        }
      });

      const writeStream = fs.createWriteStream(backupFile);
      let errorOutput = '';

      pgDump.stdout.pipe(writeStream);

      pgDump.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pgDump.on('close', (code) => {
        writeStream.end();

        if (code === 0) {
          const stats = fs.statSync(backupFile);
          const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
          console.log(`✅ Database backup created: ${path.basename(backupFile)} (${sizeInMB} MB)`);

          // Compress the backup
          this.compressBackup(backupFile).then(() => {
            resolve(backupFile + '.gz');
          }).catch(reject);
        } else {
          console.error('❌ pg_dump failed:', errorOutput);
          if (fs.existsSync(backupFile)) {
            fs.unlinkSync(backupFile);
          }
          reject(new Error(`pg_dump failed with code ${code}: ${errorOutput}`));
        }
      });

      pgDump.on('error', (error) => {
        console.error('❌ pg_dump error:', error);
        if (fs.existsSync(backupFile)) {
          fs.unlinkSync(backupFile);
        }
        reject(error);
      });
    });
  }

  async compressBackup(filePath) {
    return new Promise((resolve, reject) => {
      const gzip = spawn('gzip', [filePath]);

      gzip.on('close', (code) => {
        if (code === 0) {
          const compressedFile = filePath + '.gz';
          const stats = fs.statSync(compressedFile);
          const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
          // Backup compressed successfully
          resolve(compressedFile);
        } else {
          reject(new Error(`gzip failed with code ${code}`));
        }
      });

      gzip.on('error', (error) => {
        reject(error);
      });
    });
  }

  async performFullBackup() {
    try {
      // Create database backup
      const dbBackup = await this.performDatabaseBackup();

      // Create backup info file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                       new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
      const infoFile = path.join(this.backupDir, `backup_info_${timestamp}.json`);

      const backupInfo = {
        timestamp: new Date().toISOString(),
        type: 'full_backup',
        database_backup: path.basename(dbBackup),
        version: require('../../package.json').version || 'unknown',
        environment: process.env.NODE_ENV || 'development',
        database_stats: await this.getDatabaseStats()
      };

      fs.writeFileSync(infoFile, JSON.stringify(backupInfo, null, 2));
      // Backup info file created

      return {
        database: dbBackup,
        info: infoFile
      };
    } catch (error) {
      throw new Error(`Full backup failed: ${error.message}`);
    }
  }

  async getDatabaseStats() {
    try {
      const queries = [
        'SELECT COUNT(*) as total_users FROM users',
        'SELECT COUNT(*) as total_items FROM items',
        'SELECT COUNT(*) as total_employees FROM employees',
        'SELECT COUNT(*) as total_departments FROM departments',
        'SELECT COUNT(*) as total_notifications FROM notifications',
        'SELECT pg_size_pretty(pg_database_size(current_database())) as database_size'
      ];

      const stats = {};

      for (const query of queries) {
        try {
          const result = await db.query(query);
          const key = Object.keys(result.rows[0])[0];
          stats[key] = result.rows[0][key];
        } catch (error) {
          console.warn(`Warning: Could not get stat for query: ${query}`);
        }
      }

      return stats;
    } catch (error) {
      console.warn('Warning: Could not gather database statistics:', error);
      return {};
    }
  }

  async cleanupOldBackups() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      const files = fs.readdirSync(this.backupDir);
      let deletedCount = 0;

      for (const file of files) {
        if (file.startsWith('db_backup_') || file.startsWith('backup_info_')) {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);

          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`🗑️ Cleaned up ${deletedCount} old backup files`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old backups:', error);
    }
  }

  // Manual backup method
  async createManualBackup() {
    // Creating manual backup
    try {
      const result = await this.performDatabaseBackup();
      console.log('✅ Manual backup completed');
      return result;
    } catch (error) {
      console.error('❌ Manual backup failed:', error);
      throw error;
    }
  }

  // Get backup status
  async getBackupStatus() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('db_backup_'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            size: stats.size,
            created: stats.mtime,
            path: filePath
          };
        })
        .sort((a, b) => b.created - a.created);

      return {
        backupDir: this.backupDir,
        retentionDays: this.retentionDays,
        totalBackups: files.length,
        latestBackup: files[0] || null,
        backups: files.slice(0, 10) // Return last 10 backups
      };
    } catch (error) {
      console.error('❌ Error getting backup status:', error);
      return {
        backupDir: this.backupDir,
        retentionDays: this.retentionDays,
        totalBackups: 0,
        latestBackup: null,
        backups: [],
        error: error.message
      };
    }
  }

  stop() {
    this.schedulerStarted = false;
    console.log('🛑 Backup scheduler stopped');
  }
}

module.exports = new BackupScheduler();
