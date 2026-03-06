/**
 * Script to update existing videos with originalUrl field
 * This fixes videos uploaded before originalUrl feature was added
 */

require('dotenv').config();
const prisma = require('../src/config/db');
const path = require('path');
const fs = require('fs');

async function updateVideoOriginalUrls() {
  console.log('🔍 Finding videos without originalUrl...\n');

  try {
    // Find all videos without originalUrl
    const videos = await prisma.media.findMany({
      where: {
        type: 'VIDEO',
        OR: [
          { originalUrl: null },
          { originalUrl: '' }
        ]
      }
    });

    console.log(`Found ${videos.length} videos without originalUrl\n`);

    if (videos.length === 0) {
      console.log('✅ All videos already have originalUrl!');
      return;
    }

    let updated = 0;
    let skipped = 0;

    for (const video of videos) {
      console.log(`\n📹 Processing: ${video.name}`);
      console.log(`   ID: ${video.id}`);
      console.log(`   Current URL: ${video.url}`);
      console.log(`   Filename: ${video.filename}`);

      // Check if this is an HLS video
      const isHLS = video.url.includes('/hls/') && video.url.endsWith('/index.m3u8');

      if (isHLS) {
        // Extract the HLS directory ID from the URL
        // URL format: /uploads/hls/598bdc0a5656188e6ad120c0/index.m3u8
        const hlsMatch = video.url.match(/\/hls\/([^/]+)\//);
        
        if (hlsMatch) {
          const hlsId = hlsMatch[1];
          
          // Look for the original MP4 file in uploads directory
          const uploadsDir = path.join(__dirname, '../public/uploads');
          const files = fs.readdirSync(uploadsDir);
          
          // Find MP4 files that might match this video
          const mp4Files = files.filter(f => 
            f.endsWith('.mp4') && 
            fs.statSync(path.join(uploadsDir, f)).isFile()
          );

          console.log(`   Found ${mp4Files.length} MP4 files in uploads directory`);

          if (mp4Files.length > 0) {
            // Try to find the matching MP4 by checking file creation time
            // or just use the first one if there's only one
            let matchingMp4 = null;

            if (mp4Files.length === 1) {
              matchingMp4 = mp4Files[0];
              console.log(`   ✓ Only one MP4 found, using: ${matchingMp4}`);
            } else {
              // Try to find by similar timestamp or name
              // For now, we'll skip auto-matching if multiple files exist
              console.log(`   ⚠️  Multiple MP4 files found, cannot auto-match`);
              console.log(`   Available files: ${mp4Files.join(', ')}`);
              skipped++;
              continue;
            }

            if (matchingMp4) {
              const originalUrl = `/uploads/${matchingMp4}`;
              
              // Verify the file exists
              const filePath = path.join(uploadsDir, matchingMp4);
              if (fs.existsSync(filePath)) {
                // Update the database
                await prisma.media.update({
                  where: { id: video.id },
                  data: { originalUrl }
                });

                console.log(`   ✅ Updated originalUrl to: ${originalUrl}`);
                updated++;
              } else {
                console.log(`   ❌ File not found: ${filePath}`);
                skipped++;
              }
            }
          } else {
            console.log(`   ❌ No MP4 files found in uploads directory`);
            console.log(`   This video only has HLS segments - cannot work offline`);
            skipped++;
          }
        } else {
          console.log(`   ❌ Could not parse HLS ID from URL`);
          skipped++;
        }
      } else {
        // Not an HLS video, might already be a direct MP4
        console.log(`   ℹ️  Not an HLS video, might already be direct MP4`);
        
        // Check if the file exists
        const filePath = path.join(__dirname, '../public', video.url);
        if (fs.existsSync(filePath)) {
          // Update originalUrl to point to itself
          await prisma.media.update({
            where: { id: video.id },
            data: { originalUrl: video.url }
          });
          console.log(`   ✅ Updated originalUrl to: ${video.url}`);
          updated++;
        } else {
          console.log(`   ❌ File not found: ${filePath}`);
          skipped++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Total videos processed: ${videos.length}`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    console.log('='.repeat(60));

    if (updated > 0) {
      console.log('\n✅ Videos updated! Rebuild and reinstall the Android app to test.');
    }

    if (skipped > 0) {
      console.log('\n⚠️  Some videos could not be updated automatically.');
      console.log('   These videos may need to be re-uploaded for offline playback.');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateVideoOriginalUrls();
