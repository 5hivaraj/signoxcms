// backend/scripts/recalculateMediaFileSizes.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const publicRoot = path.join(__dirname, '../public'); // adjust if different

async function main() {
  console.log('🔍 Starting media fileSize recalculation...');

  const mediaItems = await prisma.media.findMany();
  console.log(`Found ${mediaItems.length} media records.`);

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const item of mediaItems) {
    try {
      // Only handle local uploads like /uploads/..., skip HLS URLs
      if (!item.url || !item.url.startsWith('/uploads/') || item.url.includes('/hls/')) {
        skipped++;
        continue;
      }

      const relPath = item.url.replace(/^\//, ''); // remove leading '/'
      const filePath = path.join(publicRoot, relPath);

      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ File missing on disk for media ${item.id}: ${filePath}`);
        missing++;
        continue;
      }

      const stats = fs.statSync(filePath);
      const sizeBytes = stats.size;

      if (sizeBytes === item.fileSize) {
        skipped++;
        continue; // already correct
      }

      await prisma.media.update({
        where: { id: item.id },
        data: { fileSize: sizeBytes },
      });

      console.log(`✅ Updated media ${item.id} (${item.name}) from ${item.fileSize} -> ${sizeBytes} bytes`);
      updated++;

    } catch (err) {
      console.error(`❌ Error processing media ${item.id}:`, err.message);
      skipped++;
    }
  }

  console.log('🔚 Done.');
  console.log({ updated, skipped, missing });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
