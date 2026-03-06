const prisma = require('../config/db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { checkStorageLimit, getClientStorageInfo, getClientAdminId, incrementMonthlyUpload } = require('../utils/storage.utils');
const imageOptimizationService = require('../services/image-optimization.service');
const paginationService = require('../services/pagination.service');
const { catchAsync } = require('../middleware/error.middleware');
const { getFileMetadata } = require('../utils/file.utils');

const publicRoot = path.join(__dirname, '../../public');
const uploadsDir = path.join(publicRoot, 'uploads');

/**
 * Extract video metadata using FFprobe
 * @param {string} inputPath - Full path to input video
 * @returns {Promise<{duration: number, width: number, height: number}>}
 */
function extractVideoMetadata(inputPath) {
  return new Promise((resolve) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      inputPath
    ];
    
    const proc = spawn('ffprobe', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    
    proc.on('close', (code) => {
      if (code === 0 && stdout) {
        try {
          const data = JSON.parse(stdout);
          const videoStream = data.streams?.find(s => s.codec_type === 'video');
          
          if (videoStream) {
            const duration = parseFloat(data.format?.duration || videoStream.duration || 0);
            const width = parseInt(videoStream.width || 0);
            const height = parseInt(videoStream.height || 0);
            
            resolve({ duration, width, height });
          } else {
            resolve({ duration: 0, width: 0, height: 0 });
          }
        } catch (parseError) {
          console.warn('Failed to parse ffprobe output:', parseError.message);
          resolve({ duration: 0, width: 0, height: 0 });
        }
      } else {
        console.warn('FFprobe failed:', stderr || `Exit code ${code}`);
        resolve({ duration: 0, width: 0, height: 0 });
      }
    });
    
    proc.on('error', (err) => {
      console.warn('FFprobe error:', err.message);
      resolve({ duration: 0, width: 0, height: 0 });
    });
  });
}

/**
 * Convert a video file to HLS (index.m3u8 + .ts segments) using FFmpeg.
 * @param {string} inputPath - Full path to input video (e.g. uploaded MP4)
 * @param {string} outputDir - Full path to output directory (e.g. public/uploads/hls/<mediaId>)
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
function convertToHLS(inputPath, outputDir) {
  return new Promise((resolve) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-start_number', '0',
      '-hls_time', '4',
      '-hls_list_size', '0',
      '-hls_segment_filename', 'segment_%03d.ts',
      '-f', 'hls',
      'index.m3u8',
    ];
    
    console.log(`🎬 Starting HLS conversion: ${inputPath} -> ${outputDir}`);
    
    const proc = spawn('ffmpeg', args, {
      cwd: outputDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    let stderr = '';
    let stdout = '';
    
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ HLS conversion successful: ${outputDir}`);
        resolve({ success: true });
      } else {
        console.error(`❌ HLS conversion failed with code ${code}:`, stderr.slice(-500));
        resolve({ success: false, error: stderr.slice(-500) || `FFmpeg exited with code ${code}` });
      }
    });
    
    proc.on('error', (err) => {
      console.error(`❌ HLS conversion error:`, err.message);
      resolve({ success: false, error: err.message });
    });
  });
}

exports.createMedia = catchAsync(async (req, res) => {
  console.log('📤 [MEDIA CREATE DEBUG] Starting media creation...');
  console.log('📤 [MEDIA CREATE DEBUG] Request user:', {
    id: req.user?.id,
    email: req.user?.email,
    role: req.user?.role
  });
  console.log('📤 [MEDIA CREATE DEBUG] Request body:', req.body);
  console.log('📤 [MEDIA CREATE DEBUG] Request file:', req.file ? {
    originalname: req.file.originalname,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path
  } : 'No file');

  if (!req.file) {
    console.log('❌ [MEDIA CREATE DEBUG] No file provided');
    return res.status(400).json({ message: 'File is required' });
  }

  if (!req.user?.id) {
    console.log('❌ [MEDIA CREATE DEBUG] No user authentication');
    return res.status(401).json({ message: 'User authentication required' });
  }

  const mimeType = req.file.mimetype;
  const originalName = req.file.originalname;
  // Support both disk storage (multer.diskStorage) and S3-style storage (e.g. multer-s3)
  // Disk: filename + path; S3: key + location
  const storageKey = req.file.key || req.file.filename || originalName;
  const fileSize = req.file.size;
  const fileSizeMB = fileSize / (1024 * 1024);
  const isProduction = process.env.NODE_ENV === 'production';

  // Check storage limit before processing
  const clientAdminId = await getClientAdminId(req.user.id);
  console.log('📤 [MEDIA CREATE DEBUG] Client admin ID:', clientAdminId);
  
  if (!clientAdminId) {
    console.log('❌ [MEDIA CREATE DEBUG] No client admin ID found');
    // Delete the uploaded file since we can't use it
    const filePath = req.file.path;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (deleteError) {
      console.warn('⚠️ Failed to delete rejected file:', deleteError.message);
    }
    return res.status(400).json({ 
      message: 'Unable to determine client association',
      details: 'Your account may not be properly associated with an organization. Please contact your administrator.'
    });
  }

  const storageCheck = await checkStorageLimit(req.user.id, fileSize);
  console.log('📤 [MEDIA CREATE DEBUG] Storage check result:', storageCheck);
  
  if (!storageCheck.canUpload) {
    // Delete the uploaded file since we can't use it
    const filePath = req.file.path;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (deleteError) {
      console.warn('⚠️ Failed to delete rejected file:', deleteError.message);
    }

    return res.status(413).json({ 
      message: 'Storage limit exceeded',
      details: storageCheck.reason,
      storageInfo: storageCheck.storageInfo
    });
  }

  const type = mimeType.startsWith('image/')
    ? 'IMAGE'
    : (mimeType.startsWith('video/') || mimeType === 'video/quicktime' || mimeType === 'video/x-msvideo')
      ? 'VIDEO'
      : null;

  console.log('📤 [MEDIA CREATE DEBUG] Determined media type:', type);

  if (!type) {
    console.log('❌ [MEDIA CREATE DEBUG] Unsupported file type:', mimeType);
    // Delete the uploaded file since it's not supported
    const filePath = req.file.path;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (deleteError) {
      console.warn('⚠️ Failed to delete unsupported file:', deleteError.message);
    }

    return res.status(400).json({ message: 'Unsupported file type' });
  }

  let url;
  let originalUrl = null; // Store original MP4 URL for offline playback 
  let finalFilename;
  let duration = null;
  let width = null;
  let height = null;
  let optimizationResults = null;

  if (type === 'IMAGE') {
    if (req.file.path) {
      // Local file available – run optimization against disk
      try {
        optimizationResults = await imageOptimizationService.optimizeImage(req.file.path, storageKey);
        width = optimizationResults.original.width;
        height = optimizationResults.original.height;

        console.log(`🖼️ Image optimized: ${storageKey} - Original: ${optimizationResults.original.size} bytes`);
      } catch (optimizationError) {
        console.warn('⚠️ Image optimization failed:', optimizationError.message);
      }

      url = `/uploads/${storageKey}`;
      finalFilename = storageKey;
      originalUrl = null;
    } else {
      // No local path – likely uploaded directly to S3. Use the remote URL.
      const remoteUrl = req.file.location || req.file.url || null;
      if (!remoteUrl) {
        console.error('❌ [MEDIA CREATE DEBUG] No local path or remote URL for uploaded image file');
        return res.status(500).json({ message: 'Upload processing failed: missing file location' });
      }

      url = remoteUrl;
      finalFilename = storageKey;
      originalUrl = null;

      console.log('🖼️ [MEDIA CREATE DEBUG] Using remote image URL (S3):', url);
    }
  } else if (type === 'VIDEO') {

    // In production, skip HLS conversion for large files to avoid long-running uploads.
    // This makes uploads fast and avoids 504 timeouts from Nginx.
    const shouldSkipHLS = isProduction && fileSizeMB >= 50;

    if (shouldSkipHLS) {
      console.log(`📦 [MEDIA CREATE DEBUG] Skipping HLS conversion (prod, large file ~${fileSizeMB.toFixed(2)}MB). Using original MP4.`);

      // Optionally still extract basic metadata if we have a local path
      if (req.file.path) {
        try {
          const metadata = await extractVideoMetadata(req.file.path);
          duration = metadata.duration > 0 ? Math.round(metadata.duration) : null;
          width = metadata.width > 0 ? metadata.width : null;
          height = metadata.height > 0 ? metadata.height : null;
        } catch (metaErr) {
          console.warn('⚠️ Failed to extract video metadata (skipHLS path):', metaErr.message);
        }
      }

      url = `/uploads/${storageKey}`;
      finalFilename = storageKey;
      originalUrl = null;
    } else if (req.file.path) {
      // Local file path available – run ffprobe/ffmpeg and generate HLS
      const metadata = await extractVideoMetadata(req.file.path);
      duration = metadata.duration > 0 ? Math.round(metadata.duration) : null;
      width = metadata.width > 0 ? metadata.width : null;
      height = metadata.height > 0 ? metadata.height : null;

      const mediaId = crypto.randomBytes(12).toString('hex');
      const hlsDir = path.join(uploadsDir, 'hls', mediaId);

      // Store original MP4 for fallback/offline
      originalUrl = `/uploads/${storageKey}`;
      console.log(`📦 Original MP4 URL stored: ${originalUrl}`);

      try {
        fs.mkdirSync(hlsDir, { recursive: true });
        console.log(`📁 Created HLS directory: ${hlsDir}`);
      } catch (mkdirErr) {
        console.error('❌ Failed to create HLS directory:', mkdirErr.message);
        url = `/uploads/${storageKey}`;
        finalFilename = storageKey;
      }

      if (!url) {

        const result = await convertToHLS(req.file.path, hlsDir);

        if (result.success) {

          const m3u8Path = path.join(hlsDir, 'index.m3u8');

          if (fs.existsSync(m3u8Path)) {

            url = `/uploads/hls/${mediaId}/index.m3u8`;
            finalFilename = `hls/${mediaId}/index.m3u8`;

            console.log(`✅ HLS conversion successful: ${url}`);

          } else {

            console.warn('⚠️ index.m3u8 not found after conversion');

            try {
              if (fs.existsSync(hlsDir)) {
                fs.rmSync(hlsDir, { recursive: true });
              }
            } catch (cleanupErr) {
              console.warn('⚠️ Failed cleaning HLS dir:', cleanupErr.message);
            }

            url = `/uploads/${storageKey}`;
            finalFilename = storageKey;
            originalUrl = null;
          }

        } else {

          console.warn('❌ HLS conversion failed, using original file');

          try {
            if (fs.existsSync(hlsDir)) {
              fs.rmSync(hlsDir, { recursive: true });
            }
          } catch (cleanupErr) {
            console.warn('⚠️ Failed cleaning HLS dir:', cleanupErr.message);
          }

          url = `/uploads/${storageKey}`;
          finalFilename = storageKey;
          originalUrl = null;
        }
      }
    } else {
      // No local file path – likely using S3 or other remote storage adapter
      const remoteUrl = req.file.location || req.file.url || null;
      if (!remoteUrl) {
        console.error('❌ [MEDIA CREATE DEBUG] No local path or remote URL for uploaded video file');
        return res.status(500).json({ message: 'Upload processing failed: missing file location' });
      }

      url = remoteUrl;
      finalFilename = storageKey;
      originalUrl = null;

      console.log('📦 [MEDIA CREATE DEBUG] Using remote video URL (S3):', url);
    }
  }

 // Parse endDate if provided
  let endDate = null;
  if (req.body.endDate) {
    endDate = new Date(req.body.endDate);
    if (isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'Invalid endDate format. Use ISO 8601 format.' });
    }
    if (endDate <= new Date()) {
      return res.status(400).json({ message: 'endDate must be in the future' });
    }
  }

  // Collect tags including orientation and displayMode
  const tags = [];
  if (req.body.orientation) {
    tags.push(`orientation:${req.body.orientation}`);
  }
  if (req.body.displayMode) {
    tags.push(`displayMode:${req.body.displayMode}`);
  }

  // Create media record in database
  console.log('📤 [MEDIA CREATE DEBUG] Creating media record with data:', {
    name: req.body.name || originalName,
    originalName,
    filename: finalFilename,
    type,
    url,
    originalUrl,
    fileSize,
    mimeType,
    duration,
    width,
    height,
    tags,
    endDate,
    createdById: req.user?.id || null,
  });

  const media = await prisma.media.create({
    data: {
      name: req.body.name || originalName,
      originalName,
      filename: finalFilename,
      type,
      url,
      originalUrl, 
      fileSize,
      mimeType,
      duration,
      width,
      height,
      tags,
      endDate,
      createdById: req.user?.id || null,
    },
  });

  console.log('✅ [MEDIA CREATE DEBUG] Media record created:', {
    id: media.id,
    name: media.name,
    type: media.type,
    url: media.url,
    originalUrl: media.originalUrl,   
    fileSize: media.fileSize
  });

  // Increment monthly upload counter
  await incrementMonthlyUpload(clientAdminId, fileSize);
  console.log('📊 [MEDIA CREATE DEBUG] Monthly upload counter incremented');

  // Include updated storage info in response
  const updatedStorageInfo = clientAdminId ? await getClientStorageInfo(clientAdminId) : null;
  console.log('📤 [MEDIA CREATE DEBUG] Updated storage info:', updatedStorageInfo);

  const response = { 
    media,
    storageInfo: updatedStorageInfo
  };

  // Include optimization results if available
  if (optimizationResults) {
    response.optimization = {
      thumbnail: optimizationResults.thumbnail,
      preview: optimizationResults.preview,
      optimized: optimizationResults.optimized
    };
  }

  console.log('✅ [MEDIA CREATE DEBUG] Sending response with media ID:', media.id);
  res.status(201).json(response);
});

exports.listMedia = catchAsync(async (req, res) => {
  console.log('🔍 [MEDIA DEBUG] Starting listMedia request');
  console.log('🔍 [MEDIA DEBUG] Request user:', {
    id: req.user?.id,
    email: req.user?.email,
    role: req.user?.role,
    staffRole: req.user?.staffRole
  });
  console.log('🔍 [MEDIA DEBUG] Request query params:', req.query);

  // Parse pagination and filtering parameters
  const { page, limit, skip } = paginationService.parsePaginationParams(req);
  const { search, searchFields } = paginationService.parseSearchParams(req);
  const filters = paginationService.parseFilterParams(req);
  const sort = paginationService.parseSortParams(req, { createdAt: 'desc' });

  console.log('🔍 [MEDIA DEBUG] Parsed params:', { page, limit, skip, search, filters, sort });

  // Get the current user's client admin ID to filter media
  const clientAdminId = await getClientAdminId(req.user?.id);
  console.log('🔍 [MEDIA DEBUG] Client admin ID:', clientAdminId);
  
  if (!clientAdminId) {
    console.log('❌ [MEDIA DEBUG] No client admin ID found');
    return res.status(400).json({ message: 'Unable to determine client association' });
  }

  // Get all USER_ADMINs under this client admin
  const userAdmins = await prisma.user.findMany({
    where: {
      role: 'USER_ADMIN',
      managedByClientAdminId: clientAdminId
    },
    select: { id: true }
  });

  const userAdminIds = userAdmins.map(ua => ua.id);
  console.log('🔍 [MEDIA DEBUG] User admin IDs:', userAdminIds);

  // Get all STAFF users created by these USER_ADMINs
  const staffUsers = await prisma.user.findMany({
    where: {
      role: 'STAFF',
      createdByUserAdminId: {
        in: userAdminIds
      }
    },
    select: { id: true }
  });

  console.log('🔍 [MEDIA DEBUG] Staff users:', staffUsers.map(s => s.id));

  // Combine all user IDs: client admin + user admins + staff users
  const userIds = [
    clientAdminId,
    ...userAdminIds,
    ...staffUsers.map(s => s.id)
  ];

  console.log('🔍 [MEDIA DEBUG] Combined user IDs for media filtering:', userIds);

  // Build where clause
  const where = {
    AND: [
      {
        OR: [{ type: 'IMAGE' }, { type: 'VIDEO' }], // Filter to only known-good enum values
      },
      {
        createdById: {
          in: userIds // Only show media created by users in the same client
        }
      },
      filters
    ]
  };

  console.log('🔍 [MEDIA DEBUG] Where clause:', JSON.stringify(where, null, 2));

  // Add search conditions
  if (search) {
    where.AND.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } }
      ]
    });
    console.log('🔍 [MEDIA DEBUG] Added search conditions for:', search);
  }

  console.log('🔍 [MEDIA DEBUG] Final where clause:', JSON.stringify(where, null, 2));

  // Execute paginated query
  console.log('🔍 [MEDIA DEBUG] Executing database queries...');
  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: sort,
      skip,
      take: limit,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    }),
    prisma.media.count({ where })
  ]);

  console.log('🔍 [MEDIA DEBUG] Database results:');
  console.log('🔍 [MEDIA DEBUG] - Total count:', total);
  console.log('🔍 [MEDIA DEBUG] - Media items returned:', media.length);
  console.log('🔍 [MEDIA DEBUG] - Media items:', media.map(m => ({
    id: m.id,
    name: m.name,
    type: m.type,
    createdById: m.createdById,
    createdBy: m.createdBy?.email,
    url: m.url,
    fileSize: m.fileSize
  })));

  // Enrich media items with file metadata (size and checksum) for offline playback
  const enrichedMedia = await Promise.all(media.map(async (item) => {
    try {
      // Extract file path from URL
      const urlPath = item.url.replace(/^\//, ''); // Remove leading slash
      const filePath = path.join(__dirname, '../../public', urlPath);
      
      // Check if file exists
      if (fs.existsSync(filePath)) {
        const metadata = await getFileMetadata(filePath);
        return {
          ...item,
          fileSize: metadata.fileSize,
          checksum: metadata.checksum
        };
      }
      
      // If file doesn't exist, return item as-is
      return item;
    } catch (error) {
      console.error(`Error enriching media ${item.id}:`, error.message);
      return item;
    }
  }));

  console.log('🔍 [MEDIA DEBUG] Enriched media with file metadata');

  // Include storage info for the current user's client
  const storageInfo = await getClientStorageInfo(clientAdminId);
  console.log('🔍 [MEDIA DEBUG] Storage info:', storageInfo);

  const response = paginationService.formatPaginatedResponse(enrichedMedia, total, page, limit);
  response.storageInfo = storageInfo;

  console.log('🔍 [MEDIA DEBUG] Final response structure:', {
    mediaCount: response.data?.length || 0,
    total: response.total,
    page: response.page,
    totalPages: response.totalPages,
    hasStorageInfo: !!response.storageInfo
  });

  res.json(response);
});

exports.getStorageInfo = async (req, res) => {
  try {
    const clientAdminId = await getClientAdminId(req.user?.id);
    
    if (!clientAdminId) {
      return res.status(400).json({ message: 'Unable to determine client association' });
    }

    const storageInfo = await getClientStorageInfo(clientAdminId);
    
    res.json({ storageInfo });
  } catch (error) {
    console.error('Error getting storage info:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteMedia = async (req, res) => {
  try {
    const mediaId = req.params.id;
    console.log('🗑️ [DELETE DEBUG] Starting delete process for media ID:', mediaId);

    // Get the current user's client admin ID
    const clientAdminId = await getClientAdminId(req.user?.id);
    console.log('🗑️ [DELETE DEBUG] Client admin ID:', clientAdminId);
    
    if (!clientAdminId) {
      console.log('❌ [DELETE DEBUG] No client admin ID found');
      return res.status(400).json({ message: 'Unable to determine client association' });
    }

    // Get all USER_ADMINs under this client admin
    const userAdmins = await prisma.user.findMany({
      where: {
        role: 'USER_ADMIN',
        managedByClientAdminId: clientAdminId
      },
      select: { id: true }
    });

    const userAdminIds = userAdmins.map(ua => ua.id);

    // Get all STAFF users created by these USER_ADMINs
    const staffUsers = await prisma.user.findMany({
      where: {
        role: 'STAFF',
        createdByUserAdminId: {
          in: userAdminIds
        }
      },
      select: { id: true }
    });

    // Combine all user IDs: client admin + user admins + staff users
    const userIds = [
      clientAdminId,
      ...userAdminIds,
      ...staffUsers.map(s => s.id)
    ];

    console.log('🗑️ [DELETE DEBUG] Authorized user IDs:', userIds);

    // Get media and verify it belongs to the same client
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        createdBy: {
          select: { id: true }
        }
      }
    });

    console.log('🗑️ [DELETE DEBUG] Found media:', media ? {
      id: media.id,
      name: media.name,
      url: media.url,
      filename: media.filename,
      createdById: media.createdById
    } : 'null');

    if (!media) {
      console.log('❌ [DELETE DEBUG] Media not found');
      return res.status(404).json({ message: 'Media not found' });
    }

    // Check if the media was created by someone in the same client (or has no creator - allow org members to delete)
    if (media.createdById && !userIds.includes(media.createdById)) {
      console.log('❌ [DELETE DEBUG] Access denied - media created by user not in organization');
      return res.status(403).json({ message: 'Access denied. You can only delete media from your organization.' });
    }
    if (media.createdById && !userIds.includes(media.createdById)) {
      console.log('❌ [DELETE DEBUG] Access denied - media created by user not in organization');
      return res.status(403).json({ message: 'Access denied. You can only delete media from your organization.' });
    }

    // Check if media is used in any playlists
    const playlistItem = await prisma.playlistItem.findFirst({
      where: { mediaId },
      select: { id: true },
    });

    if (playlistItem) {
      console.log('❌ [DELETE DEBUG] Media is used in playlists');
      return res.status(400).json({
        message: 'Cannot delete media that is used in playlists. Remove it from playlists first.',
      });
    }

    // Check if media is used in any layout sections
    const layoutSectionItem = await prisma.layoutSectionItem.findFirst({
      where: { mediaId },
      select: { id: true },
    });

    if (layoutSectionItem) {
      console.log('❌ [DELETE DEBUG] Media is used in layouts');
      return res.status(400).json({
        message: 'Cannot delete media that is used in layouts. Remove it from layouts first.',
      });
    }

    // Check if media is used in any widgets
    const widget = await prisma.widget.findFirst({
      where: { mediaId },
      select: { id: true },
    });

    if (widget) {
      console.log('❌ [DELETE DEBUG] Media is used in widgets');
      return res.status(400).json({
        message: 'Cannot delete media that is used in widgets. Remove it from widgets first.',
      });
    }

    console.log('🗑️ [DELETE DEBUG] All checks passed, proceeding with deletion');

    // Delete the media record
    await prisma.media.delete({
      where: { id: mediaId },
    });

    console.log('✅ [DELETE DEBUG] Media record deleted from database');

    // Delete the file (or HLS directory) from filesystem (best-effort)
    if (media.url && media.url.startsWith('/uploads/')) {
      const diskPath = path.join(__dirname, '../../public', media.url);
      console.log('🗑️ [DELETE DEBUG] Attempting to delete file at:', diskPath);
      
      try {
        if (media.url.includes('/hls/') && media.url.endsWith('/index.m3u8')) {
          const hlsDir = path.dirname(diskPath);
          console.log('🗑️ [DELETE DEBUG] Deleting HLS directory:', hlsDir);
          if (fs.existsSync(hlsDir)) {
            fs.rmSync(hlsDir, { recursive: true });
            console.log('✅ [DELETE DEBUG] HLS directory deleted successfully');
          } else {
            console.log('⚠️ [DELETE DEBUG] HLS directory does not exist:', hlsDir);
          }
        } else {
          console.log('🗑️ [DELETE DEBUG] Deleting single file:', diskPath);
          if (fs.existsSync(diskPath)) {
            fs.unlinkSync(diskPath);
            console.log('✅ [DELETE DEBUG] File deleted successfully');
          } else {
            console.log('⚠️ [DELETE DEBUG] File does not exist:', diskPath);
          }
        }

        // Also try to delete optimized versions if they exist
        if (media.type === 'IMAGE') {
          const optimizedDir = path.join(__dirname, '../../public/uploads/optimized');
          const thumbnailDir = path.join(__dirname, '../../public/uploads/thumbnails');
          const baseFilename = media.filename?.replace(/\.[^/.]+$/, '') || '';
          
          // Delete optimized versions
          const optimizedFiles = [
            path.join(optimizedDir, `${baseFilename}_optimized.jpg`),
            path.join(optimizedDir, `${baseFilename}_optimized.webp`),
            path.join(optimizedDir, `${baseFilename}_preview.jpg`),
            path.join(thumbnailDir, `${baseFilename}_thumb.jpg`)
          ];

          optimizedFiles.forEach(filePath => {
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('✅ [DELETE DEBUG] Deleted optimized file:', filePath);
              }
            } catch (optimizedError) {
              console.warn('⚠️ [DELETE DEBUG] Failed to delete optimized file:', filePath, optimizedError.message);
            }
          });
        }

      } catch (e) {
        console.error('❌ [DELETE DEBUG] Failed to delete file from disk:', e.message);
        console.error('❌ [DELETE DEBUG] File path was:', diskPath);
      }
    } else {
      console.log('⚠️ [DELETE DEBUG] No file to delete (invalid URL):', media.url);
    }

    // Include updated storage info in response
    const updatedStorageInfo = await getClientStorageInfo(clientAdminId);
    console.log('🗑️ [DELETE DEBUG] Updated storage info:', updatedStorageInfo);

    console.log('✅ [DELETE DEBUG] Delete operation completed successfully');
    res.json({ 
      message: 'Media deleted successfully',
      storageInfo: updatedStorageInfo
    });
  } catch (error) {
    console.error('❌ [DELETE DEBUG] Error deleting media:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateMedia = async (req, res) => {
  try {
    const mediaId = req.params.id;
    const { name, description, tags, endDate } = req.body;

    // Get the current user's client admin ID
    const clientAdminId = await getClientAdminId(req.user?.id);
    
    if (!clientAdminId) {
      return res.status(400).json({ message: 'Unable to determine client association' });
    }

    // Get all USER_ADMINs under this client admin
    const userAdmins = await prisma.user.findMany({
      where: {
        role: 'USER_ADMIN',
        managedByClientAdminId: clientAdminId
      },
      select: { id: true }
    });

    const userAdminIds = userAdmins.map(ua => ua.id);

    // Get all STAFF users created by these USER_ADMINs
    const staffUsers = await prisma.user.findMany({
      where: {
        role: 'STAFF',
        createdByUserAdminId: {
          in: userAdminIds
        }
      },
      select: { id: true }
    });

    // Combine all user IDs: client admin + user admins + staff users
    const userIds = [
      clientAdminId,
      ...userAdminIds,
      ...staffUsers.map(s => s.id)
    ];

    // Check if media exists and belongs to the same client
    const existingMedia = await prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        createdBy: {
          select: { id: true }
        }
      }
    });

    if (!existingMedia) {
      return res.status(404).json({ message: 'Media not found' });
    }

    // Check if the media was created by someone in the same client
    if (!existingMedia.createdById || !userIds.includes(existingMedia.createdById)) {
      return res.status(403).json({ message: 'Access denied. You can only modify media from your organization.' });
    }

    // Validate endDate if provided
    let parsedEndDate = existingMedia.endDate;
    if (endDate !== undefined) {
      if (endDate === null) {
        parsedEndDate = null;
      } else {
        parsedEndDate = new Date(endDate);
        if (isNaN(parsedEndDate.getTime())) {
          return res.status(400).json({ message: 'Invalid endDate format. Use ISO 8601 format.' });
        }
        if (parsedEndDate <= new Date()) {
          return res.status(400).json({ message: 'endDate must be in the future' });
        }
      }
    }

    // Update media
    const updatedMedia = await prisma.media.update({
      where: { id: mediaId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(tags !== undefined && { tags }),
        endDate: parsedEndDate,
      },
    });

    res.json({ media: updatedMedia });
  } catch (error) {
    console.error('Error updating media:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.cleanupExpiredMedia = async () => {
  try {
    // Find all expired media
    const expiredMedia = await prisma.media.findMany({
      where: {
        endDate: {
        not: null,  
	lte: new Date(),
        },
      },
      include: {
        playlistItems: true,
        widgets: true,
      },
    });

    if (expiredMedia.length === 0) {
      return { deleted: 0, errors: [] };
    }
    
    const results = {
      deleted: 0,
      errors: [],
    };

    for (const media of expiredMedia) {
      try {
        // Remove from playlists first
        if (media.playlistItems.length > 0) {
          await prisma.playlistItem.deleteMany({
            where: { mediaId: media.id },
          });
        }

        // Remove from widgets
        if (media.widgets.length > 0) {
          await prisma.widget.updateMany({
            where: { mediaId: media.id },
            data: { mediaId: null },
          });
        }

        // Delete the media record
        await prisma.media.delete({
          where: { id: media.id },
        });

        // Delete the file (or HLS directory) from filesystem
        if (media.url && media.url.startsWith('/uploads/')) {
          const diskPath = path.join(__dirname, '../../public', media.url);
          try {
            if (media.url.includes('/hls/') && media.url.endsWith('/index.m3u8')) {
              const hlsDir = path.dirname(diskPath);
              if (fs.existsSync(hlsDir)) {
                fs.rmSync(hlsDir, { recursive: true });
              }
            } else if (fs.existsSync(diskPath)) {
              fs.unlinkSync(diskPath);
            }
          } catch (fileError) {
            results.errors.push(`Failed to delete file ${media.filename}: ${fileError.message}`);
          }
        }

        results.deleted++;
        
      } catch (mediaError) {
        results.errors.push(`Failed to delete media ${media.name}: ${mediaError.message}`);
      }
    }

    return results;
    
  } catch (error) {
    console.error('Error during media cleanup:', error);
    throw error;
  }
};
