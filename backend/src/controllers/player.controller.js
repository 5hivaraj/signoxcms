const prisma = require('../config/db');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { getCurrentTimeIST, getCurrentDayIST, timeToMinutes, INDIA_TIMEZONE } = require('../utils/timezone.utils');
const { getFileMetadata } = require('../utils/file.utils');

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

async function getDisplayFromDeviceToken(req) {
  const token = getBearerToken(req);
  if (!token) return null;

  // Verify the JWT so random strings can't access config
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
  } catch {
    return null;
  }

  // Token is stored verbatim in the Display record after pairing
  return await prisma.display.findFirst({
    where: { deviceToken: token },
  });
}

/**
 * GET /api/player/config
 * Requires: Authorization: Bearer <deviceToken>
 * Returns: { playlist: null, layout: null } if no content assigned, else playlist or layout with ordered items + media
 * Priority: Active Schedules > Assigned Layout > Assigned Playlist
 */
exports.getConfig = async (req, res) => {
  try {
    const display = await getDisplayFromDeviceToken(req);
    if (!display) return res.status(401).json({ error: 'Unauthorized' });

    // First, check for active schedules (highest priority)
    const activeSchedule = await getActiveScheduleForDisplay(display.id);
    
    if (activeSchedule) {
      // Return schedule content (layout takes priority over playlist in schedule)
      if (activeSchedule.layout) {
        return res.json({
          playlist: null,
          layout: await formatLayoutResponse(activeSchedule.layout),
          activeSchedule: {
            id: activeSchedule.id,
            name: activeSchedule.name,
            priority: activeSchedule.priority,
            orientation: activeSchedule.orientation || 'LANDSCAPE'
          }
        });
      } else if (activeSchedule.playlist) {
        return res.json({
          playlist: await formatPlaylistResponse(activeSchedule.playlist),
          layout: null,
          activeSchedule: {
            id: activeSchedule.id,
            name: activeSchedule.name,
            priority: activeSchedule.priority,
            orientation: activeSchedule.orientation || 'LANDSCAPE'
          }
        });
      }
    }

    // No active schedule, check for directly assigned layout (second priority)
    if (display.layoutId) {
      const layout = await prisma.layout.findUnique({
        where: { id: display.layoutId },
        include: {
          sections: {
            orderBy: { order: 'asc' },
            include: {
              items: {
                orderBy: { order: 'asc' },
                include: {
                  media: {
                    select: {
                      id: true,
                      name: true,
                      type: true,
                      url: true,
                      originalUrl: true,
                      duration: true,
                      mimeType: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (layout) {
        return res.json({
          playlist: null,
          layout: await formatLayoutResponse(layout),
        });
      }
    }

    // Fall back to directly assigned playlist (lowest priority)
    if (display.playlistId) {
      const playlist = await prisma.playlist.findUnique({
        where: { id: display.playlistId },
        include: {
          items: {
            orderBy: { order: 'asc' },
            include: {
              media: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  url: true,
                  originalUrl: true,
                  duration: true,
                  mimeType: true,
                  fileSize: true,
                  width: true,
                  height: true,
                },
              },
            },
          },
        },
      });

      if (playlist) {
        return res.json({
          playlist: await formatPlaylistResponse(playlist),
          layout: null,
        });
      }
    }

    // No content assigned
    return res.json({ playlist: null, layout: null });
  } catch (error) {
    console.error('Player Config Error:', error);
    res.status(500).json({ error: 'Failed to load config' });
  }
};

/**
 * GET /api/player/debug
 * Debug endpoint to check schedule status
 */
exports.getDebugInfo = async (req, res) => {
  try {
    const display = await getDisplayFromDeviceToken(req);
    if (!display) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit'
    });
    const currentDay = now.toLocaleDateString('en-US', { 
      weekday: 'long',
      timeZone: 'UTC'
    }).toLowerCase();

    // Get all schedules for this display
    const allSchedules = await prisma.schedule.findMany({
      where: {
        displays: {
          some: {
            displayId: display.id
          }
        }
      },
      include: {
        playlist: { select: { id: true, name: true } },
        layout: { select: { id: true, name: true } }
      }
    });

    const activeSchedule = await getActiveScheduleForDisplay(display.id);

    return res.json({
      display: {
        id: display.id,
        name: display.name,
        assignedPlaylist: display.playlistId,
        assignedLayout: display.layoutId
      },
      currentTime,
      currentDay,
      allSchedules: allSchedules.map(s => ({
        id: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        repeatDays: s.repeatDays,
        isActive: s.isActive,
        priority: s.priority,
        content: s.playlist ? `Playlist: ${s.playlist.name}` : s.layout ? `Layout: ${s.layout.name}` : 'No content'
      })),
      activeSchedule: activeSchedule ? {
        id: activeSchedule.id,
        name: activeSchedule.name,
        priority: activeSchedule.priority,
        content: activeSchedule.playlist ? `Playlist: ${activeSchedule.playlist.name}` : activeSchedule.layout ? `Layout: ${activeSchedule.layout.name}` : 'No content'
      } : null
    });
  } catch (error) {
    console.error('Debug Info Error:', error);
    res.status(500).json({ error: 'Failed to get debug info' });
  }
};

/**
 * Get active schedule for a specific display
 */
async function getActiveScheduleForDisplay(displayId) {
  try {
    const now = new Date();
    
    // Use India timezone utilities
    const currentTimeIST = getCurrentTimeIST();
    const currentDayIST = getCurrentDayIST();
    const currentDateIST = now.toLocaleDateString('en-CA', { timeZone: INDIA_TIMEZONE }); // YYYY-MM-DD

    const activeSchedules = await prisma.schedule.findMany({
      where: {
        isActive: true,
        repeatDays: {
          has: currentDayIST
        },
        displays: {
          some: {
            displayId: displayId
          }
        },
        // Start date: schedule has started (or no start date)
        OR: [
          { startDate: null },
          { startDate: { lte: now } }
        ]
        // endDate filtered in code below so "date-only" endDate (midnight) = active all that day
      },
      include: {
        playlist: {
          include: {
            items: {
              orderBy: { order: 'asc' },
              include: {
                media: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    url: true,
                    originalUrl: true,
                    duration: true,
                    mimeType: true,
                    fileSize: true,
                    width: true,
                    height: true,
                  },
                },
              },
            },
          },
        },
        layout: {
          include: {
            sections: {
              orderBy: { order: 'asc' },
              include: {
                items: {
                  orderBy: { order: 'asc' },
                  include: {
                    media: {
                      select: {
                        id: true,
                        name: true,
                        type: true,
                        url: true,
                        duration: true,
                        mimeType: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        priority: 'desc' // Highest priority first
      }
    });

    // Filter by end date: if endDate set, active until end of that day (so date-only = full day)
    const dateFilteredSchedules = activeSchedules.filter(schedule => {
      if (!schedule.endDate) return true;
      const endDateIST = schedule.endDate.toLocaleDateString('en-CA', { timeZone: INDIA_TIMEZONE });
      return currentDateIST <= endDateIST;
    });

    // Filter by time - all schedules use IST
    const timeFilteredSchedules = dateFilteredSchedules.filter(schedule => {
      const startTime = schedule.startTime;
      const endTime = schedule.endTime;
      
      // Convert times to minutes for easier comparison
      const currentMinutes = timeToMinutes(currentTimeIST);
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    });

    // Return the highest priority active schedule
    return timeFilteredSchedules.length > 0 ? timeFilteredSchedules[0] : null;
  } catch (error) {
    console.error('Error getting active schedule:', error);
    return null;
  }
}

/**
 * Enrich media object with file metadata (size and checksum) for offline playback
 */
async function enrichMediaWithMetadata(media) {
  if (!media || !media.url) return media;
  
  try {
    // Extract file path from URL
    const urlPath = media.url.replace(/^\//, ''); // Remove leading slash
    const filePath = path.join(__dirname, '../../public', urlPath);
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
      const metadata = await getFileMetadata(filePath);
      return {
        ...media,
        fileSize: metadata.fileSize,
        checksum: metadata.checksum
      };
    }
    
    return media;
  } catch (error) {
    console.error(`Error enriching media ${media.id}:`, error.message);
    return media;
  }
}

/**
 * Format layout response
 */
async function formatLayoutResponse(layout) {
  // Enrich all media items with file metadata
  const enrichedSections = await Promise.all(layout.sections.map(async (section) => {
    const enrichedItems = await Promise.all(
      section.items
        .filter((item) => item.media !== null)
        .map(async (item) => {
          const enrichedMedia = await enrichMediaWithMetadata(item.media);
          return {
            id: item.id,
            order: item.order,
            duration: item.duration,
            orientation: item.orientation || 'LANDSCAPE',
            resizeMode: item.resizeMode || 'FIT',
            rotation: item.rotation ?? 0,
            media: enrichedMedia,
          };
        })
    );

    return {
      id: section.id,
      name: section.name,
      order: section.order,
      x: section.x,
      y: section.y,
      width: section.width,
      height: section.height,
      loopEnabled: section.loopEnabled,
      frequency: section.frequency,
      items: enrichedItems,
    };
  }));

  return {
    id: layout.id,
    name: layout.name,
    width: layout.width,
    height: layout.height,
    orientation: layout.orientation || 'LANDSCAPE',
    sections: enrichedSections,
  };
}

/**
 * Format playlist response
 */
async function formatPlaylistResponse(playlist) {
  // Enrich all media items with file metadata
  const enrichedItems = await Promise.all(
    playlist.items
      .filter((it) => it.media != null && it.media.url)
      .map(async (it) => {
        const enrichedMedia = await enrichMediaWithMetadata(it.media);
        return {
          id: it.id,
          order: it.order,
          duration: it.duration,
          loopVideo: it.loopVideo === true,
          orientation: it.orientation || 'LANDSCAPE',
          resizeMode: it.resizeMode || 'FIT',
          rotation: it.rotation ?? 0,
          media: enrichedMedia,
        };
      })
  );

  return {
    id: playlist.id,
    name: playlist.name,
    items: enrichedItems,
  };
}