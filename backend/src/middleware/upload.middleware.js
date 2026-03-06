const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists (public folder for static access)
const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  // Accept images: JPEG, PNG, GIF, WebP
  // Accept videos: MP4, WebM, MOV, AVI
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
  ];
  
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.mp4', '.webm', '.mov', '.avi'
  ];

  const extOk = allowedExts.includes(ext);
  const mimeOk = allowedMimes.includes(file.mimetype);

  if (mimeOk && extOk) {
    return cb(null, true);
  } else {
    const supportedFormats = 'JPEG, PNG, GIF, WebP images and MP4, WebM, MOV, AVI videos';
    cb(new Error(`Only ${supportedFormats} are allowed! Received: ${file.mimetype} (${ext})`));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 600 * 1024 * 1024 }, // 600MB limit (supports large videos >500MB for HLS conversion)
  fileFilter: fileFilter,
});

module.exports = upload;

