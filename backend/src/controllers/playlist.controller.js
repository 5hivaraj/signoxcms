const prisma = require('../config/db');
const { getClientAdminId } = require('../utils/storage.utils');

/** Get all user IDs in the client: client admin + user admins + staff (matches media.controller so media/playlists from staff are visible). */
async function getClientUserIds(clientAdminId) {
  const userAdmins = await prisma.user.findMany({
    where: {
      role: 'USER_ADMIN',
      managedByClientAdminId: clientAdminId
    },
    select: { id: true }
  });
  const userAdminIds = userAdmins.map(ua => ua.id);
  const staffUsers = await prisma.user.findMany({
    where: {
      role: 'STAFF',
      createdByUserAdminId: { in: userAdminIds }
    },
    select: { id: true }
  });
  return [
    clientAdminId,
    ...userAdminIds,
    ...staffUsers.map(s => s.id)
  ];
}

exports.listPlaylists = async (req, res) => {
  try {
    // Get the current user's client admin ID to filter playlists
    const clientAdminId = await getClientAdminId(req.user?.id);
    
    if (!clientAdminId) {
      return res.status(400).json({ message: 'Unable to determine client association' });
    }

    const userIds = await getClientUserIds(clientAdminId);

    // Filter playlists to only show those created by users within the same client
    const playlists = await prisma.playlist.findMany({
      where: {
        createdById: {
          in: userIds
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      },
    });

    res.json({ playlists });
  } catch (error) {
    console.error('List Playlists CRASH:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Playlist ID is required' });

    // Get the current user's client admin ID
    const clientAdminId = await getClientAdminId(req.user?.id);
    
    if (!clientAdminId) {
      return res.status(400).json({ message: 'Unable to determine client association' });
    }

    const userIds = await getClientUserIds(clientAdminId);

    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { media: true },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      },
    });

    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

    // Check if the playlist was created by someone in the same client
    if (!playlist.createdById || !userIds.includes(playlist.createdById)) {
      return res.status(403).json({ message: 'Access denied. You can only access playlists from your organization.' });
    }

    res.json({ playlist });
  } catch (error) {
    console.error('Get Playlist Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createPlaylist = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Playlist name required' });
    const playlist = await prisma.playlist.create({
      data: { name, createdById: req.user?.id || null },
    });
    res.status(201).json({ playlist });
  } catch (error) {
    console.error('Create Playlist Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updatePlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, items } = req.body;
    if (!id) return res.status(400).json({ message: 'Playlist ID is required' });
    if (!name) return res.status(400).json({ message: 'Playlist name required' });
    if (!Array.isArray(items)) return res.status(400).json({ message: 'items must be an array' });

    // Get the current user's client admin ID
    const clientAdminId = await getClientAdminId(req.user?.id);
    
    if (!clientAdminId) {
      return res.status(400).json({ message: 'Unable to determine client association' });
    }

    const userIds = await getClientUserIds(clientAdminId);

    // Check if playlist exists and belongs to the same client
    const exists = await prisma.playlist.findUnique({ 
      where: { id }, 
      select: { 
        id: true, 
        createdById: true 
      } 
    });
    
    if (!exists) return res.status(404).json({ message: 'Playlist not found' });

    // Check if the playlist was created by someone in the same client
    if (!exists.createdById || !userIds.includes(exists.createdById)) {
      return res.status(403).json({ message: 'Access denied. You can only modify playlists from your organization.' });
    }

    // Validate that all media items belong to the same client
    if (items.length > 0) {
      for (const it of items) {
        if (!it.mediaId) return res.status(400).json({ message: 'Each item must include mediaId' });
        if (typeof it.order !== 'number') return res.status(400).json({ message: 'Each item must include numeric order' });
      }

      // Check if all media items belong to the same client
      const mediaIds = items.map(item => item.mediaId);
      const mediaItems = await prisma.media.findMany({
        where: {
          id: { in: mediaIds }
        },
        select: {
          id: true,
          createdById: true
        }
      });

      // Verify all media items exist and belong to the same client
      for (const mediaItem of mediaItems) {
        if (!mediaItem.createdById || !userIds.includes(mediaItem.createdById)) {
          return res.status(403).json({ message: 'Access denied. You can only use media from your organization in playlists.' });
        }
      }

      if (mediaItems.length !== mediaIds.length) {
        return res.status(400).json({ message: 'Some media items were not found or are not accessible.' });
      }
    }

    const validResizeModes = ['FIT', 'FILL', 'STRETCH'];
    const validRotation = (r) => [0, 90, 180, 270].includes(Number(r));
    const itemData = items.map((it) => ({
      playlistId: id,
      mediaId: it.mediaId,
      duration: it.duration ?? null,
      order: it.order,
      loopVideo: it.loopVideo === true,
      orientation: it.orientation === 'LANDSCAPE' || it.orientation === 'PORTRAIT' ? it.orientation : null,
      resizeMode: it.resizeMode && validResizeModes.includes(String(it.resizeMode).toUpperCase()) ? String(it.resizeMode).toUpperCase() : 'FIT',
      rotation: validRotation(it.rotation) ? Number(it.rotation) : 0,
    }));

    try {
      await prisma.$transaction([
        prisma.playlist.update({ where: { id }, data: { name } }),
        prisma.playlistItem.deleteMany({ where: { playlistId: id } }),
        ...(items.length > 0 ? [
          prisma.playlistItem.createMany({
            data: itemData,
          })
        ] : []),
      ]);
    } catch (createError) {
      const msg = createError?.message || '';
      // Fallback for older DB schema without orientation/resizeMode
      if (items.length > 0 && (msg.includes('Unknown arg') || msg.includes('loopVideo') || msg.includes('orientation') || msg.includes('resizeMode') || msg.includes('rotation') || msg.includes('Invalid'))) {
        await prisma.$transaction([
          prisma.playlist.update({ where: { id }, data: { name } }),
          prisma.playlistItem.deleteMany({ where: { playlistId: id } }),
          prisma.playlistItem.createMany({
            data: items.map((it) => ({
              playlistId: id,
              mediaId: it.mediaId,
              duration: it.duration ?? null,
              order: it.order,
            })),
          }),
        ]);
      } else {
        throw createError;
      }
    }

    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: { items: { orderBy: { order: 'asc' }, include: { media: true } } },
    });
    res.json({ playlist });
  } catch (error) {
    console.error('Update Playlist Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deletePlaylist = async (req, res) => {
  try {
    const playlistId = req.params.id;

    // Get the current user's client admin ID
    const clientAdminId = await getClientAdminId(req.user?.id);
    
    if (!clientAdminId) {
      return res.status(400).json({ message: 'Unable to determine client association' });
    }

    const userIds = await getClientUserIds(clientAdminId);

    // Check if playlist exists and belongs to the same client
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      select: {
        id: true,
        createdById: true
      }
    });

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check if the playlist was created by someone in the same client
    if (!playlist.createdById || !userIds.includes(playlist.createdById)) {
      return res.status(403).json({ message: 'Access denied. You can only delete playlists from your organization.' });
    }

    // Check if playlist is assigned to any display
    const display = await prisma.display.findFirst({
      where: { playlistId: playlistId },
      select: { id: true },
    });
    
    if (display) {
      return res.status(400).json({ message: 'Cannot delete playlist that is assigned to a display.' });
    }

    await prisma.$transaction([
      prisma.playlistItem.deleteMany({ where: { playlistId } }),
      prisma.playlist.delete({ where: { id: playlistId } }),
    ]);
    
    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Delete Playlist Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
