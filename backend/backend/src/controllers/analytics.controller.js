const prisma = require('../config/db');

/**
 * GET /api/analytics/summary
 * Returns role-aware analytics for dashboards.
 */
exports.getSummary = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (user.role === 'SUPER_ADMIN') {
      console.log('📊 [ANALYTICS DEBUG] Super Admin requesting summary');
      const [clientCount, displayCount, onlineDisplays] = await Promise.all([
        prisma.user.count({ where: { role: 'CLIENT_ADMIN' } }),
        // Only count paired displays (exclude PAIRING status)
        prisma.display.count({ where: { isPaired: true } }),
        prisma.display.count({ where: { status: 'ONLINE', isPaired: true } }),
      ]);

      console.log('📊 [ANALYTICS DEBUG] Super Admin counts:', {
        clientCount,
        displayCount,
        onlineDisplays
      });

      return res.json({
        role: 'SUPER_ADMIN',
        totalClients: clientCount,
        totalDisplays: displayCount,
        onlineDisplays,
        offlineDisplays: displayCount - onlineDisplays,
        totalContent: 0,
        totalPlaylists: 0,
        averageUptime: 0,
        totalPlaybackTime: 0,
        systemHealth: {
          status: 'OK',
          uptime: process.uptime(),
        },
      });
    }

    if (user.role === 'CLIENT_ADMIN') {
      const [profile, userAdminCount, displayCount, onlineCount] = await Promise.all([
        prisma.clientProfile.findUnique({
          where: { clientAdminId: user.id },
        }),
        prisma.user.count({
          where: {
            role: 'USER_ADMIN',
            managedByClientAdminId: user.id,
          },
        }),
        // Only count paired displays
        prisma.display.count({
          where: { 
            clientAdminId: user.id,
            isPaired: true 
          },
        }),
        prisma.display.count({
          where: { 
            clientAdminId: user.id,
            isPaired: true,
            status: 'ONLINE'
          },
        }),
      ]);

      const totalDisplaysAllowed = profile?.maxDisplays ?? 0;
      const licenseExpiry = profile?.licenseExpiry ?? null;
      const licenseActive = profile?.isActive ?? true;

      return res.json({
        role: 'CLIENT_ADMIN',
        userAdmins: userAdminCount,
        totalDisplays: displayCount,
        onlineDisplays: onlineCount,
        offlineDisplays: displayCount - onlineCount,
        displayLimit: totalDisplaysAllowed,
        totalContent: 0,
        totalPlaylists: 0,
        averageUptime: 0,
        totalPlaybackTime: 0,
        license: {
          status: licenseActive ? 'ACTIVE' : 'SUSPENDED',
          expiry: licenseExpiry,
        },
      });
    }

    if (user.role === 'USER_ADMIN') {
      console.log('📊 [ANALYTICS DEBUG] User Admin requesting summary:', user.email);
      const [myDisplays, mediaCount, playlistCount] = await Promise.all([
        // Only get paired displays
        prisma.display.findMany({
          where: { 
            managedByUserId: user.id,
            isPaired: true 
          },
          select: { status: true },
        }),
        prisma.media.count({
          where: { createdById: user.id },
        }),
        prisma.playlist.count({
          where: { createdById: user.id },
        }),
      ]);

      console.log('📊 [ANALYTICS DEBUG] User Admin counts:', {
        userId: user.id,
        displayCount: myDisplays.length,
        mediaCount,
        playlistCount
      });

      const online = myDisplays.filter((d) => d.status === 'ONLINE').length;
      const offline = myDisplays.filter((d) => d.status !== 'ONLINE').length;

      // Approximate storage: sum fileSize where available
      const storageAgg = await prisma.media.aggregate({
        where: { createdById: user.id },
        _sum: { fileSize: true },
      });
      const bytes = storageAgg._sum.fileSize ?? 0;

      return res.json({
        role: 'USER_ADMIN',
        totalDisplays: myDisplays.length,
        onlineDisplays: online,
        offlineDisplays: offline,
        totalContent: mediaCount,
        totalPlaylists: playlistCount,
        averageUptime: 0,
        totalPlaybackTime: 0,
        displays: {
          total: myDisplays.length,
          online,
          offline,
        },
        mediaCount,
        playlistCount,
        storageBytes: bytes,
      });
    }

    // Other roles (STAFF, etc.) can receive a minimal payload or 403
    return res.status(403).json({ message: 'Analytics not available for this role' });
  } catch (error) {
    console.error('Analytics Summary Error:', error);
    res.status(500).json({ message: 'Failed to load analytics summary', error: error.message });
  }
};

