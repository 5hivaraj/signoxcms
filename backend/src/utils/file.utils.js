const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');

/**
 * File utilities for offline playback support
 * Provides file size and checksum calculation
 */

/**
 * Calculate file size in bytes
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<number>} File size in bytes
 */
async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error getting file size for ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * Calculate SHA-256 checksum of a file
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<string>} SHA-256 hash in hex format
 */
async function calculateChecksum(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    console.error(`Error calculating checksum for ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Get file metadata (size and checksum)
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<Object>} Object with fileSize and checksum
 */
async function getFileMetadata(filePath) {
  try {
    const [fileSize, checksum] = await Promise.all([
      getFileSize(filePath),
      calculateChecksum(filePath)
    ]);
    
    return {
      fileSize,
      checksum,
      fileName: path.basename(filePath)
    };
  } catch (error) {
    console.error(`Error getting file metadata for ${filePath}:`, error.message);
    return {
      fileSize: 0,
      checksum: null,
      fileName: path.basename(filePath)
    };
  }
}

/**
 * Validate file integrity using checksum
 * @param {string} filePath - Absolute path to file
 * @param {string} expectedChecksum - Expected SHA-256 checksum
 * @returns {Promise<boolean>} True if checksums match
 */
async function validateFileIntegrity(filePath, expectedChecksum) {
  try {
    const actualChecksum = await calculateChecksum(filePath);
    return actualChecksum === expectedChecksum;
  } catch (error) {
    console.error(`Error validating file integrity for ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Format file size to human-readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "1.5 MB")
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
  getFileSize,
  calculateChecksum,
  getFileMetadata,
  validateFileIntegrity,
  formatFileSize
};
