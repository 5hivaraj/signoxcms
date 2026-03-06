require('dotenv').config();
const prisma = require('../src/config/db');

async function checkVideo() {
  try {
    const videos = await prisma.media.findMany({
      where: {
        name: {
          contains: 'Zootopia'
        }
      }
    });

    console.log('\n=== ZOOTOPIA VIDEO DATA ===\n');
    
    if (videos.length === 0) {
      console.log('❌ No Zootopia video found in database!');
    } else {
      videos.forEach(video => {
        console.log('ID:', video.id);
        console.log('Name:', video.name);
        console.log('Type:', video.type);
        console.log('URL:', video.url);
        console.log('Original URL:', video.originalUrl || 'NULL');
        console.log('Filename:', video.filename);
        console.log('File Size:', video.fileSize);
        console.log('---');
      });
    }

    // Also check what the player API would return
    console.log('\n=== CHECKING PLAYER API DATA ===\n');
    
    const displays = await prisma.display.findMany({
      take: 1,
      include: {
        playlist: {
          include: {
            items: {
              include: {
                media: {
                  select: {
                    id: true,
                    name: true,
                    url: true,
                    originalUrl: true,
                  }
                }
              }
            }
          }
        }
      }
    });

    if (displays.length > 0 && displays[0].playlist) {
      console.log('Display:', displays[0].name);
      console.log('Playlist:', displays[0].playlist.name);
      console.log('Items:');
      displays[0].playlist.items.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.media.name}`);
        console.log(`     URL: ${item.media.url}`);
        console.log(`     Original URL: ${item.media.originalUrl || 'NULL'}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkVideo();
