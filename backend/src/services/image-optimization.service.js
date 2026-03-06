const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class ImageOptimizationService {
  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'public/uploads');
    this.optimizedDir = path.join(this.uploadsDir, 'optimized');
    this.thumbnailDir = path.join(this.uploadsDir, 'thumbnails');
    
    this.ensureDirectories();
    
    // Optimization settings
    this.settings = {
      jpeg: {
        quality: parseInt(process.env.JPEG_QUALITY) || 85,
        progressive: true
      },
      png: {
        compressionLevel: parseInt(process.env.PNG_COMPRESSION) || 8,
        progressive: true
      },
      webp: {
        quality: parseInt(process.env.WEBP_QUALITY) || 80,
        effort: 4
      },
      thumbnail: {
        width: parseInt(process.env.THUMBNAIL_WIDTH) || 300,
        height: parseInt(process.env.THUMBNAIL_HEIGHT) || 300,
        fit: 'cover'
      },
      preview: {
        width: parseInt(process.env.PREVIEW_WIDTH) || 800,
        height: parseInt(process.env.PREVIEW_HEIGHT) || 600,
        fit: 'inside'
      }
    };
  }

  ensureDirectories() {
    [this.optimizedDir, this.thumbnailDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Optimize image with multiple formats and sizes
  async optimizeImage(inputPath, filename) {
    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      
      console.log(`🖼️ Optimizing image: ${filename} (${metadata.width}x${metadata.height})`);
      
      const baseName = path.parse(filename).name;
      const results = {
        original: {
          path: inputPath,
          size: fs.statSync(inputPath).size,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format
        },
        optimized: {},
        thumbnail: null,
        preview: null
      };

      // Generate optimized versions
      await Promise.all([
        this.generateOptimizedJPEG(image, baseName, results),
        this.generateOptimizedWebP(image, baseName, results),
        this.generateThumbnail(image, baseName, results),
        this.generatePreview(image, baseName, results)
      ]);

      return results;
    } catch (error) {
      console.error(`❌ Image optimization failed for ${filename}:`, error);
      throw error;
    }
  }

  // Generate optimized JPEG
  async generateOptimizedJPEG(image, baseName, results) {
    try {
      const outputPath = path.join(this.optimizedDir, `${baseName}_optimized.jpg`);
      
      await image
        .jpeg(this.settings.jpeg)
        .toFile(outputPath);
      
      const stats = fs.statSync(outputPath);
      const metadata = await sharp(outputPath).metadata();
      
      results.optimized.jpeg = {
        path: outputPath,
        url: `/uploads/optimized/${baseName}_optimized.jpg`,
        size: stats.size,
        width: metadata.width,
        height: metadata.height,
        compressionRatio: (1 - stats.size / results.original.size) * 100
      };
    } catch (error) {
      console.error('❌ JPEG optimization failed:', error);
    }
  }

  // Generate optimized WebP
  async generateOptimizedWebP(image, baseName, results) {
    try {
      const outputPath = path.join(this.optimizedDir, `${baseName}_optimized.webp`);
      
      await image
        .webp(this.settings.webp)
        .toFile(outputPath);
      
      const stats = fs.statSync(outputPath);
      const metadata = await sharp(outputPath).metadata();
      
      results.optimized.webp = {
        path: outputPath,
        url: `/uploads/optimized/${baseName}_optimized.webp`,
        size: stats.size,
        width: metadata.width,
        height: metadata.height,
        compressionRatio: (1 - stats.size / results.original.size) * 100
      };
    } catch (error) {
      console.error('❌ WebP optimization failed:', error);
    }
  }

  // Generate thumbnail
  async generateThumbnail(image, baseName, results) {
    try {
      const outputPath = path.join(this.thumbnailDir, `${baseName}_thumb.jpg`);
      
      await image
        .resize(this.settings.thumbnail.width, this.settings.thumbnail.height, {
          fit: this.settings.thumbnail.fit,
          withoutEnlargement: true
        })
        .jpeg({ quality: 90 })
        .toFile(outputPath);
      
      const stats = fs.statSync(outputPath);
      const metadata = await sharp(outputPath).metadata();
      
      results.thumbnail = {
        path: outputPath,
        url: `/uploads/thumbnails/${baseName}_thumb.jpg`,
        size: stats.size,
        width: metadata.width,
        height: metadata.height
      };
    } catch (error) {
      console.error('❌ Thumbnail generation failed:', error);
    }
  }

  // Generate preview image
  async generatePreview(image, baseName, results) {
    try {
      const outputPath = path.join(this.optimizedDir, `${baseName}_preview.jpg`);
      
      await image
        .resize(this.settings.preview.width, this.settings.preview.height, {
          fit: this.settings.preview.fit,
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toFile(outputPath);
      
      const stats = fs.statSync(outputPath);
      const metadata = await sharp(outputPath).metadata();
      
      results.preview = {
        path: outputPath,
        url: `/uploads/optimized/${baseName}_preview.jpg`,
        size: stats.size,
        width: metadata.width,
        height: metadata.height
      };
    } catch (error) {
      console.error('❌ Preview generation failed:', error);
    }
  }

  // Resize image to specific dimensions
  async resizeImage(inputPath, width, height, options = {}) {
    try {
      const {
        fit = 'cover',
        quality = 85,
        format = 'jpeg',
        outputPath = null
      } = options;

      const image = sharp(inputPath);
      let resized = image.resize(width, height, { fit, withoutEnlargement: true });

      // Apply format-specific settings
      if (format === 'jpeg') {
        resized = resized.jpeg({ quality });
      } else if (format === 'png') {
        resized = resized.png({ compressionLevel: 8 });
      } else if (format === 'webp') {
        resized = resized.webp({ quality });
      }

      if (outputPath) {
        await resized.toFile(outputPath);
        return outputPath;
      } else {
        return await resized.toBuffer();
      }
    } catch (error) {
      console.error('❌ Image resize failed:', error);
      throw error;
    }
  }

  // Convert image format
  async convertFormat(inputPath, outputFormat, options = {}) {
    try {
      const { quality = 85, outputPath = null } = options;
      const image = sharp(inputPath);
      
      let converted;
      if (outputFormat === 'jpeg') {
        converted = image.jpeg({ quality });
      } else if (outputFormat === 'png') {
        converted = image.png({ compressionLevel: 8 });
      } else if (outputFormat === 'webp') {
        converted = image.webp({ quality });
      } else {
        throw new Error(`Unsupported format: ${outputFormat}`);
      }

      if (outputPath) {
        await converted.toFile(outputPath);
        return outputPath;
      } else {
        return await converted.toBuffer();
      }
    } catch (error) {
      console.error('❌ Format conversion failed:', error);
      throw error;
    }
  }

  // Get image metadata
  async getImageMetadata(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      const stats = fs.statSync(imagePath);
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: stats.size,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        channels: metadata.channels,
        colorspace: metadata.space
      };
    } catch (error) {
      console.error('❌ Failed to get image metadata:', error);
      throw error;
    }
  }

  // Batch optimize images
  async batchOptimize(imagePaths) {
    const results = [];
    const batchSize = 5; // Process 5 images at a time
    
    for (let i = 0; i < imagePaths.length; i += batchSize) {
      const batch = imagePaths.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (imagePath) => {
          const filename = path.basename(imagePath);
          return await this.optimizeImage(imagePath, filename);
        })
      );
      
      results.push(...batchResults);
      
      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < imagePaths.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  // Clean up old optimized images
  async cleanupOptimizedImages(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days
    try {
      const directories = [this.optimizedDir, this.thumbnailDir];
      let cleanedCount = 0;
      
      for (const dir of directories) {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          
          if (Date.now() - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            cleanedCount++;
          }
        }
      }
      
      console.log(`🧹 Cleaned up ${cleanedCount} old optimized images`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      return 0;
    }
  }

  // Get optimization statistics
  getOptimizationStats() {
    try {
      const getDirectoryStats = (dir) => {
        if (!fs.existsSync(dir)) return { count: 0, totalSize: 0 };
        
        const files = fs.readdirSync(dir);
        let totalSize = 0;
        
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
        });
        
        return { count: files.length, totalSize };
      };
      
      const optimizedStats = getDirectoryStats(this.optimizedDir);
      const thumbnailStats = getDirectoryStats(this.thumbnailDir);
      
      return {
        optimized: optimizedStats,
        thumbnails: thumbnailStats,
        total: {
          count: optimizedStats.count + thumbnailStats.count,
          totalSize: optimizedStats.totalSize + thumbnailStats.totalSize
        }
      };
    } catch (error) {
      console.error('❌ Failed to get optimization stats:', error);
      return null;
    }
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = new ImageOptimizationService();