const prisma = require('../config/db');
const { getClientAdminId } = require('../utils/storage.utils');

/**
 * GET /api/proof-of-play
 * Get proof of play data for displays in the user's organization
 * Shows display activity, assigned content, and playback information
 */
exports.getProofOfPlay = async (req, res) => {
  try {
    const user = req.user;

    // Get the current user's client admin ID to filter displays
    const clientAdminId = await getClientAdminId(user?.id);
    
    if (!clientAdminId) {
      return res.status(400).json({ message: 'Unable to determine client association' });
    }

    // Get all users under this client admin
    const clientUsers = await prisma.user.findMany({
      where: {
        OR: [
          { id: clientAdminId },
          { managedByClientAdminId: clientAdminId }
        ]
      },
      select: { id: true }
    });

    const userIds = clientUsers.map(user => user.id);

    // Get displays managed by users in this organization
    let displays;
    
    if (user.role === 'SUPER_ADMIN') {
      // Super Admin sees all displays
      displays = await prisma.display.findMany({
        include: {
          playlist: {
            include: {
              items: {
                include: {
                  media: true
                },
                orderBy: { order: 'asc' }
              }
            }
          },
          layout: {
            include: {
              sections: {
                include: {
                  items: {
                    include: {
                      media: true
                    },
                    orderBy: { order: 'asc' }
                  }
                },
                orderBy: { order: 'asc' }
              }
            }
          },
          managedByUser: {
            select: {
              id: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { lastHeartbeat: 'desc' }
      });
    } else if (user.role === 'CLIENT_ADMIN') {
      displays = await prisma.display.findMany({
        where: {
          clientAdminId: user.id
        },
        include: {
          playlist: {
            include: {
              items: {
                include: {
                  media: true
                },
                orderBy: { order: 'asc' }
              }
            }
          },
          layout: {
            include: {
              sections: {
                include: {
                  items: {
                    include: {
                      media: true
                    },
                    orderBy: { order: 'asc' }
                  }
                },
                orderBy: { order: 'asc' }
              }
            }
          },
          managedByUser: {
            select: {
              id: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { lastHeartbeat: 'desc' }
      });
    } else if (user.role === 'USER_ADMIN') {
      displays = await prisma.display.findMany({
        where: {
          managedByUserId: user.id
        },
        include: {
          playlist: {
            include: {
              items: {
                include: {
                  media: true
                },
                orderBy: { order: 'asc' }
              }
            }
          },
          layout: {
            include: {
              sections: {
                include: {
                  items: {
                    include: {
                      media: true
                    },
                    orderBy: { order: 'asc' }
                  }
                },
                orderBy: { order: 'asc' }
              }
            }
          }
        },
        orderBy: { lastHeartbeat: 'desc' }
      });
    } else if (user.role === 'STAFF' && user.staffRole === 'POP_MANAGER') {
      // POP Manager sees displays managed by their User Admin
      const staffUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          createdByUserAdmin: true
        }
      });

      if (staffUser?.createdByUserAdminId) {
        displays = await prisma.display.findMany({
          where: {
            managedByUserId: staffUser.createdByUserAdminId
          },
          include: {
            playlist: {
              include: {
                items: {
                  include: {
                    media: true
                  },
                  orderBy: { order: 'asc' }
                }
              }
            },
            layout: {
              include: {
                sections: {
                  include: {
                    items: {
                      include: {
                        media: true
                      },
                      orderBy: { order: 'asc' }
                    }
                  },
                  orderBy: { order: 'asc' }
                }
              }
            }
          },
          orderBy: { lastHeartbeat: 'desc' }
        });
      } else {
        displays = [];
      }
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Calculate display status and format proof of play data
    const proofOfPlayData = displays.map(display => {
      // Determine if display is online (heartbeat within last 2 minutes)
      const isOnline = display.lastHeartbeat && 
        (new Date() - new Date(display.lastHeartbeat)) < 2 * 60 * 1000;

      // Get media items from playlist or layout
      const mediaItems = [];
      
      if (display.playlist) {
        display.playlist.items.forEach(item => {
          if (item.media) {
            mediaItems.push({
              id: item.media.id,
              name: item.media.name,
              type: item.media.type,
              url: item.media.url,
              order: item.order,
              duration: item.duration || item.media.duration
            });
          }
        });
      } else if (display.layout) {
        display.layout.sections.forEach(section => {
          section.items.forEach(item => {
            if (item.media) {
              mediaItems.push({
                id: item.media.id,
                name: item.media.name,
                type: item.media.type,
                url: item.media.url,
                order: item.order,
                duration: item.duration || item.media.duration,
                section: section.name
              });
            }
          });
        });
      }

      return {
        display: {
          id: display.id,
          name: display.name || 'Unnamed Display',
          location: display.location,
          status: isOnline ? 'ONLINE' : 'OFFLINE',
          lastHeartbeat: display.lastHeartbeat,
          lastSeenAt: display.lastSeenAt,
          pairedAt: display.pairedAt,
          createdAt: display.createdAt
        },
        content: {
          type: display.playlist ? 'playlist' : display.layout ? 'layout' : null,
          name: display.playlist?.name || display.layout?.name || null,
          mediaItems: mediaItems
        },
        managedBy: display.managedByUser ? {
          id: display.managedByUser.id,
          email: display.managedByUser.email
        } : null
      };
    });

    res.json({ proofOfPlay: proofOfPlayData });
  } catch (error) {
    console.error('Get Proof of Play Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
