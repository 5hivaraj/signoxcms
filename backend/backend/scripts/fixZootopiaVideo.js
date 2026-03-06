require('dotenv').config();
const prisma = require('../src/config/db');
const path = require('path');
const fs = require('fs');

async function fixVideo() {
  try {
    console.log('\n🔧 Fixing Zootopia video...\n');

    // Find the video
    const video = await prisma.media.findFirst({
      where: {
        name: {
          contains: 'Zootopia'
        }
      }
    });

    if (!video) {
      console.log('❌ Zootopia video not found!');
      return;
    }

    console.log('Found video:');
    console.log('  ID:', video.id);
    console.log('  Name:', video.name);
    console.log('  URL:', video.url);
    console.log('  Original URL:', video.originalUrl || 'NULL');
    console.log('');

    // Check for MP4 files in uploads directory
    const uploadsDir = path.join(__dirname, '../public/uploads');
    const files = fs.readdirSync(uploadsDir);
    const mp4Files = files.filter(f => f.endsWith('.mp4') && fs.statSync(path.join(uploadsDir, f)).isFile());

    console.log(`Found ${mp4Files.length} MP4 files in uploads:`);
    mp4Files.forEach((f, idx) => {
      const stats = fs.statSync(path.join(uploadsDir, f));
      console.log(`  ${idx + 1}. ${f} (${Math.round(stats.size / 1024 / 1024)} MB)`);
    });
    console.log('');

    // The Zootopia video is ~25-26MB, so find the matching file
    const zootopiaFile = mp4Files.find(f => {
      const stats = fs.statSync(path.join(uploadsDir, f));
      const sizeMB = Math.round(stats.size / 1024 / 1024);
      return sizeMB >= 25 && sizeMB <= 27; // Zootopia is around 25-26MB
    });

    if (!zootopiaFile) {
      console.log('❌ Could not find matching MP4 file (26MB)');
      console.log('');
      console.log('💡 Solution: Upload a NEW video through the web interface.');
      console.log('   New videos will automatically have originalUrl populated.');
      return;
    }

    console.log(`✅ Found matching file: ${zootopiaFile}`);
    console.log('');

    const originalUrl = `/uploads/${zootopiaFile}`;
    
    // Update the database
    await prisma.media.update({
      where: { id: video.id },
      data: { originalUrl }
    });

    console.log(`✅ Updated database!`);
    console.log(`   Original URL set to: ${originalUrl}`);
    console.log('');
    console.log('🎉 Done! Now:');
    console.log('   1. Close the Android app completely');
    console.log('   2. Reopen the app');
    console.log('   3. The video should now use MP4 for offline caching');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixVideo();
