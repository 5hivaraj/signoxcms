const prisma = require('../config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Calculate display status based on last heartbeat
 * @param {Object} display - Display object with lastHeartbeat and isPaired
 * @returns {string} Status: 'ONLINE', 'OFFLINE', 'PAIRING', 'ERROR'
 */
const calculateDisplayStatus = (display) => {
  if (!display.isPaired) {
    return 'PAIRING';
  }
  
  if (!display.lastHeartbeat) {
    return 'OFFLINE';
  }
  
  const now = new Date();
  const lastHeartbeat = new Date(display.lastHeartbeat);
  const timeDiff = (now - lastHeartbeat) / 1000; // seconds
  
  // Consider display offline if no heartbeat for more than 60 seconds
  // (heartbeat interval is 30 seconds, so 60 seconds gives some buffer)
  if (timeDiff > 60) {
    return 'OFFLINE';
  }
  
  return 'ONLINE';
};

/**
 * Generate a unique 6-digit pairing code
 * @returns {Promise<string>} Unique 6-digit pairing code
 */
const generatePairingCode = async () => {
  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    // Generate random 6-digit code (100000 to 999999)
    code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Check if code already exists
    const existing = await prisma.display.findUnique({
      where: { pairingCode: code },
    });

    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique pairing code after multiple attempts');
  }

  return code;
};

/**
 * POST /api/displays/pairing-code
 * Generate a new pairing code for a display
 */
exports.generatePairingCode = async (req, res) => {
  try {
    // Generate unique 6-digit pairing code (retry if collision)
    let pairingCode;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Check if code already exists
      const existing = await prisma.display.findUnique({
        where: { pairingCode },
      });

      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'Failed to generate unique pairing code. Please try again.' });
    }

    // Generate a unique temporary device token
    let tempToken;
    let tokenUnique = false;
    let tokenAttempts = 0;
    const maxTokenAttempts = 10;

    while (!tokenUnique && tokenAttempts < maxTokenAttempts) {
      tempToken = crypto.randomBytes(32).toString('hex');
      
      const existingToken = await prisma.display.findUnique({
        where: { deviceToken: tempToken },
      });

      if (!existingToken) {
        tokenUnique = true;
      }
      tokenAttempts++;
    }

    if (!tokenUnique) {
      return res.status(500).json({ error: 'Failed to generate unique device token. Please try again.' });
    }

    const display = await prisma.display.create({
      data: {
        pairingCode,
        status: 'PAIRING',
        isPaired: false,
        name: 'Unpaired Display',
        lastHeartbeat: new Date(),
        deviceToken: tempToken,
      },
    });

    return res.json({
      // Legacy fields for existing frontend code
      pairingCode,
      displayId: display.id,
      // Extra fields if you want to use them elsewhere
      code: pairingCode,
      id: display.id,
    });
  } catch (error) {
    console.error('PAIRING ERROR:', error);
    return res
      .status(500)
      .json({ error: 'Database failed to create display', details: error.message });
  }
};

/**
 * POST /api/displays/pair
 * Pair a display with a User Admin
 * 
 * Ghost Buster Logic: If pairing with a name that already exists,
 * delete old unpaired entries with the same name
 */
exports.pairDisplay = async (req, res) => {
  try {
    const { pairingCode, name, managedByUserId } = req.body;
    const user = req.user; // From requireAuth middleware

    if (!pairingCode) {
      return res.status(400).json({ error: 'Pairing code is required' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    // Find the display trying to pair
    const display = await prisma.display.findUnique({
      where: { pairingCode },
    });

    if (!display) {
      return res.status(404).json({ error: 'Invalid pairing code' });
    }

    if (display.isPaired) {
      return res.status(400).json({ error: 'Display is already paired' });
    }

    // Determine the User Admin who will manage this display
    let targetUserAdminId = null;
    let clientAdminId = null;

    if (user.role === 'SUPER_ADMIN') {
      // Super Admin can pair to any User Admin
      if (!managedByUserId) {
        return res.status(400).json({ error: 'managedByUserId is required for Super Admin pairing' });
      }
      
      // Verify the target user is a USER_ADMIN
      const targetUser = await prisma.user.findUnique({
        where: { id: managedByUserId },
      });

      if (!targetUser || targetUser.role !== 'USER_ADMIN') {
        return res.status(400).json({ error: 'Target user must be a USER_ADMIN' });
      }

      targetUserAdminId = managedByUserId;
      clientAdminId = targetUser.managedByClientAdminId;
    } else if (user.role === 'CLIENT_ADMIN') {
      // Client Admin can pair to any User Admin under them
      if (managedByUserId) {
        // Verify the User Admin belongs to this Client Admin
        const targetUser = await prisma.user.findUnique({
          where: { 
            id: managedByUserId,
            managedByClientAdminId: user.id,
            role: 'USER_ADMIN',
          },
        });

        if (!targetUser) {
          return res.status(403).json({ error: 'User Admin not found or does not belong to your organization' });
        }

        targetUserAdminId = managedByUserId;
      } else {
        // If not specified, Client Admin can manage directly (optional)
        // For now, we'll require a User Admin
        return res.status(400).json({ error: 'managedByUserId is required' });
      }
      clientAdminId = user.id;
    } else if (user.role === 'USER_ADMIN') {
      // User Admin pairs to themselves
      targetUserAdminId = user.id;
      clientAdminId = user.managedByClientAdminId;
    } else if (user.role === 'STAFF' && user.staffRole === 'DISPLAY_MANAGER') {
      // Display Manager pairs displays for their User Admin
      const staffUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          createdByUserAdmin: true,
        },
      });

      if (!staffUser?.createdByUserAdminId || !staffUser.createdByUserAdmin) {
        return res.status(403).json({ error: 'Unable to determine your User Admin for pairing' });
      }

      targetUserAdminId = staffUser.createdByUserAdminId;
      clientAdminId = staffUser.createdByUserAdmin.managedByClientAdminId;
    } else {
      return res.status(403).json({ error: 'Insufficient permissions to pair displays' });
    }

    // ============================================
    // 🔐 LICENSE LIMIT ENFORCEMENT (SaaS)
    // ============================================
    if (clientAdminId) {
      // Look up license limits for this client
      const profile = await prisma.clientProfile.findUnique({
        where: { clientAdminId },
      });

      const maxDisplays = profile?.maxDisplays ?? 10;

      // Count currently active displays for this client (paired & not in pairing mode)
      const activeDisplays = await prisma.display.count({
        where: {
          clientAdminId,
          isPaired: true,
          status: { not: 'PAIRING' },
        },
      });

      if (activeDisplays >= maxDisplays) {
        return res.status(403).json({
          error: 'License limit reached. Contact Super Admin.',
        });
      }
    }

    // ============================================
    // 👻 GHOST BUSTER LOGIC
    // ============================================
    // If pairing with a name that already exists, delete old unpaired entries
    const ghostDisplays = await prisma.display.findMany({
      where: {
        name: name,
        id: { not: display.id }, // Exclude current display
        isPaired: false, // Only delete unpaired displays
        status: 'PAIRING', // Only delete displays in pairing mode
      },
    });

    if (ghostDisplays.length > 0) {
      await prisma.display.deleteMany({
        where: {
          name: name,
          id: { not: display.id },
          isPaired: false,
          status: 'PAIRING',
        },
      });
    }
    // ============================================

    // Generate device token
    const deviceToken = jwt.sign(
      { 
        displayId: display.id, 
        type: 'display',
        managedByUserId: targetUserAdminId,
      },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '365d' }
    );

    // Update display with pairing information
    const updatedDisplay = await prisma.display.update({
      where: { id: display.id },
      data: {
        name,
        isPaired: true,
        status: 'ONLINE',
        deviceToken,
        managedByUserId: targetUserAdminId,
        clientAdminId: clientAdminId,
        pairedAt: new Date(),
        lastSeenAt: new Date(),
        lastHeartbeat: new Date(),
      },
      include: {
        managedByUser: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        clientAdmin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Display paired successfully',
      display: updatedDisplay,
      deviceToken,
    });
  } catch (error) {
    console.error('Pair Display Error:', error);
    res.status(500).json({ 
      error: 'Failed to pair display', 
      details: error.message 
    });
  }
};

/**
 * GET /api/displays
 * Get all displays (filtered by user role)
 */
exports.getDisplays = async (req, res) => {
  try {
    const user = req.user;
    let displays;

    // Clean up orphaned displays before fetching (displays in pairing mode for more than 24 hours)
    await cleanupOrphanedDisplays();

    if (user.role === 'SUPER_ADMIN') {
      // Super Admin sees only displays that are properly paired and associated with clients
      displays = await prisma.display.findMany({
        where: {
          isPaired: true,                    // Only paired displays
          clientAdminId: { not: null },      // Must have a client admin
          managedByUserId: { not: null },    // Must have a managing user
        },
        orderBy: { createdAt: 'desc' },
        include: {
          playlist: {
            select: {
              id: true,
              name: true,
            },
          },
          layout: {
            select: {
              id: true,
              name: true,
            },
          },
          managedByUser: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          clientAdmin: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      });
    } else if (user.role === 'CLIENT_ADMIN') {
      // Client Admin sees only paired displays in their organization
      displays = await prisma.display.findMany({
        where: {
          clientAdminId: user.id,
          isPaired: true,                    // Only paired displays
        },
        orderBy: { createdAt: 'desc' },
        include: {
          playlist: {
            select: {
              id: true,
              name: true,
            },
          },
          layout: {
            select: {
              id: true,
              name: true,
            },
          },
          managedByUser: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      });
    } else if (user.role === 'USER_ADMIN') {
      // User Admin sees only paired displays they manage
      displays = await prisma.display.findMany({
        where: {
          managedByUserId: user.id,
          isPaired: true,                    // Only paired displays
        },
        orderBy: { createdAt: 'desc' },
        include: {
          playlist: {
            select: {
              id: true,
              name: true,
            },
          },
          layout: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } else if (user.role === 'STAFF') {
      // Staff sees displays based on their role
      if (user.staffRole === 'DISPLAY_MANAGER' || user.staffRole === 'BROADCAST_MANAGER' || user.staffRole === 'CMS_VIEWER') {
        // These roles can see displays managed by their User Admin
        const staffUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            createdByUserAdmin: true,
          },
        });

        if (staffUser?.createdByUserAdminId) {
          displays = await prisma.display.findMany({
            where: {
              managedByUserId: staffUser.createdByUserAdminId,
              isPaired: true,                    // Only paired displays
            },
            orderBy: { createdAt: 'desc' },
            include: {
              playlist: {
                select: {
                  id: true,
                  name: true,
                },
              },
              layout: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });
        } else {
          displays = [];
        }
      } else {
        displays = [];
      }
    } else {
      displays = [];
    }

    // Calculate real-time status and add active schedule info for each display
    const displaysWithStatusAndSchedules = await Promise.all(
      displays.map(async (display) => {
        const activeSchedule = await getActiveScheduleForDisplay(display.id);
        
        return {
          ...display,
          status: calculateDisplayStatus(display),
          activeSchedule: activeSchedule ? {
            id: activeSchedule.id,
            name: activeSchedule.name,
            priority: activeSchedule.priority,
            contentType: activeSchedule.playlist ? 'playlist' : 'layout',
            contentName: activeSchedule.playlist?.name || activeSchedule.layout?.name
          } : null
        };
      })
    );

    res.json({ displays: displaysWithStatusAndSchedules });
  } catch (error) {
    console.error('Get Displays Error:', error);
    res.status(500).json({ error: 'Failed to fetch displays', details: error.message });
  }
};

/**
 * Get active schedule for a specific display (helper function)
 */
async function getActiveScheduleForDisplay(displayId) {
  try {
    const now = new Date();
    
    // Get current time in HH:MM format - use local timezone
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Get current day name - use local timezone
    const currentDay = now.toLocaleDateString('en-US', { 
      weekday: 'long'
    }).toLowerCase();

    const activeSchedules = await prisma.schedule.findMany({
      where: {
        isActive: true,
        repeatDays: {
          has: currentDay
        },
        displays: {
          some: {
            displayId: displayId
          }
        },
        // Date range filters
        OR: [
          { startDate: null },
          { startDate: { lte: now } }
        ],
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } }
            ]
          }
        ]
      },
      include: {
        playlist: {
          select: {
            id: true,
            name: true,
          },
        },
        layout: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        priority: 'desc' // Highest priority first
      }
    });

    // Filter by time manually for better control
    const timeFilteredSchedules = activeSchedules.filter(schedule => {
      const scheduleTimezone = schedule.timezone || 'UTC';
      
      // Get current time in the appropriate timezone
      let timeToCompare = currentTime;
      if (scheduleTimezone === 'UTC') {
        // For UTC schedules, convert current time to UTC
        timeToCompare = now.toLocaleTimeString('en-US', { 
          hour12: false, 
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      const currentMinutes = timeToMinutes(timeToCompare);
      const startMinutes = timeToMinutes(schedule.startTime);
      const endMinutes = timeToMinutes(schedule.endTime);
      
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
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * GET /api/displays/:id
 * Get a specific display
 */
exports.getDisplay = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const display = await prisma.display.findUnique({
      where: { id },
      include: {
        playlist: {
          include: {
            items: {
              include: {
                media: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        layout: {
          include: {
            widgets: {
              include: {
                media: true,
              },
            },
          },
        },
        managedByUser: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        clientAdmin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!display) {
      return res.status(404).json({ error: 'Display not found' });
    }

    // Check access permissions
    if (user.role === 'SUPER_ADMIN') {
      // Super Admin can access any display
    } else if (user.role === 'CLIENT_ADMIN' && display.clientAdminId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    } else if (user.role === 'USER_ADMIN' && display.managedByUserId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    } else if (user.role === 'STAFF') {
      // Staff access depends on their role and User Admin
      const staffUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      if (display.managedByUserId !== staffUser?.createdByUserAdminId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Calculate real-time status
    const displayWithStatus = {
      ...display,
      status: calculateDisplayStatus(display)
    };

    res.json(displayWithStatus);
  } catch (error) {
    console.error('Get Display Error:', error);
    res.status(500).json({ error: 'Failed to fetch display', details: error.message });
  }
};

/**
 * PATCH /api/displays/:id
 * Update a display (assign playlist, layout, update name, etc.)
 */
exports.updateDisplay = async (req, res) => {
  try {
    const { id } = req.params;
    const { playlistId, layoutId, name, tags, location, orientation } = req.body;
    const user = req.user;

    // Check if display exists and user has access
    const display = await prisma.display.findUnique({
      where: { id },
    });

    if (!display) {
      return res.status(404).json({ error: 'Display not found' });
    }

    // Check permissions
    if (user.role === 'SUPER_ADMIN') {
      // Super Admin can update any display
    } else if (user.role === 'CLIENT_ADMIN') {
      // Client Admin can update displays in their organization
      if (display.clientAdminId && display.clientAdminId.toString() !== user.id.toString()) {
        return res.status(403).json({ error: 'Access denied: Display does not belong to your organization' });
      }
    } else if (user.role === 'USER_ADMIN') {
      // User Admin can update displays they manage
      if (!display.managedByUserId || display.managedByUserId.toString() !== user.id.toString()) {
        console.log('Permission check failed (USER_ADMIN updateDisplay):', {
          displayManagedBy: display.managedByUserId?.toString(),
          userId: user.id.toString(),
        });
        return res.status(403).json({ error: 'Access denied: You can only update displays you manage' });
      }
    } else if (user.role === 'STAFF') {
      // Staff with DISPLAY_MANAGER or BROADCAST_MANAGER can manage displays for their User Admin
      const allowedStaffRoles = ['DISPLAY_MANAGER', 'BROADCAST_MANAGER'];
      if (!allowedStaffRoles.includes(user.staffRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const staffUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { createdByUserAdminId: true },
      });

      if (
        !staffUser?.createdByUserAdminId ||
        !display.managedByUserId ||
        display.managedByUserId.toString() !== staffUser.createdByUserAdminId.toString()
      ) {
        return res.status(403).json({ error: 'Access denied: Display not managed by your User Admin' });
      }
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate layout exists if layoutId is provided
    if (layoutId !== undefined && layoutId !== null && layoutId !== '') {
      const layoutExists = await prisma.layout.findUnique({
        where: { id: layoutId },
        select: { id: true }
      });
      
      if (!layoutExists) {
        return res.status(404).json({ error: 'Layout not found' });
      }
    }

    // Validate playlist exists if playlistId is provided
    if (playlistId !== undefined && playlistId !== null && playlistId !== '') {
      const playlistExists = await prisma.playlist.findUnique({
        where: { id: playlistId },
        select: { id: true }
      });
      
      if (!playlistExists) {
        return res.status(404).json({ error: 'Playlist not found' });
      }
    }

    const updateData = {};
    
    // Handle playlist assignment using scalar field
    if (playlistId !== undefined) {
      if (playlistId === '' || playlistId === null) {
        updateData.playlistId = null;
      } else {
        updateData.playlistId = playlistId;
      }
    }
    
    // Handle layout assignment using scalar field
    if (layoutId !== undefined) {
      if (layoutId === '' || layoutId === null) {
        updateData.layoutId = null;
      } else {
        updateData.layoutId = layoutId;
      }
    }
    
    // Handle simple fields
    if (name !== undefined) updateData.name = name;
    if (tags !== undefined) updateData.tags = tags;
    if (location !== undefined) updateData.location = location;
    if (orientation !== undefined) updateData.orientation = orientation;

    const updatedDisplay = await prisma.display.update({
      where: { id },
      data: updateData,
      include: {
        playlist: {
          select: {
            id: true,
            name: true,
          },
        },
        layout: {
          select: {
            id: true,
            name: true,
          },
        },
        managedByUser: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    res.json(updatedDisplay);
  } catch (error) {
    console.error('Update Display Error:', error);
    res.status(500).json({ error: 'Failed to update display', details: error.message });
  }
};

/**
 * DELETE /api/displays/:id
 * Delete a display
 */
exports.deleteDisplay = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const display = await prisma.display.findUnique({
      where: { id },
    });

    if (!display) {
      return res.status(404).json({ error: 'Display not found' });
    }

    // Check permissions
    if (user.role === 'SUPER_ADMIN') {
      // Super Admin can delete any display
    } else if (user.role === 'CLIENT_ADMIN') {
      // Client Admin can delete displays in their organization
      if (display.clientAdminId && display.clientAdminId.toString() !== user.id.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (user.role === 'USER_ADMIN') {
      // User Admin can delete displays they manage
      if (!display.managedByUserId || display.managedByUserId.toString() !== user.id.toString()) {
        return res.status(403).json({ error: 'Access denied: You can only delete displays you manage' });
      }
    } else if (user.role === 'STAFF' && user.staffRole === 'DISPLAY_MANAGER') {
      // Display Manager can delete displays managed by their User Admin
      const staffUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { createdByUserAdminId: true },
      });

      if (
        !staffUser?.createdByUserAdminId ||
        !display.managedByUserId ||
        display.managedByUserId.toString() !== staffUser.createdByUserAdminId.toString()
      ) {
        return res.status(403).json({ error: 'Access denied: Display not managed by your User Admin' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions to delete displays' });
    }

    await prisma.display.delete({
      where: { id },
    });

    res.json({ message: 'Display deleted successfully' });
  } catch (error) {
    console.error('Delete Display Error:', error);
    res.status(500).json({ error: 'Failed to delete display', details: error.message });
  }
};

/**
 * POST /api/displays/check-status
 * Check if a display has been paired (public endpoint for player)
 */
exports.checkPairingStatus = async (req, res) => {
  try {
    const { pairingCode } = req.body;

    if (!pairingCode) {
      return res.status(400).json({ error: 'Pairing code is required' });
    }

    const display = await prisma.display.findUnique({
      where: { pairingCode },
    });

    if (!display) {
      return res.json({ isPaired: false, status: 'NOT_FOUND' });
    }

    if (!display.isPaired) {
      return res.json({ isPaired: false, status: 'PAIRING' });
    }

    // Display is paired, return device token
    return res.json({
      isPaired: true,
      status: display.status,
      deviceToken: display.deviceToken,
      displayId: display.id,
    });
  } catch (error) {
    console.error('Check Pairing Status Error:', error);
    res.status(500).json({ error: 'Failed to check pairing status' });
  }
};

/**
 * GET /api/displays/:id/status
 * Get display status (pairingCode, status, isPaired) - PUBLIC endpoint for player
 */
exports.getDisplayStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const display = await prisma.display.findUnique({
      where: { id },
      select: {
        id: true,
        pairingCode: true,
        status: true,
        isPaired: true,
        deviceToken: true,
      },
    });

    if (!display) {
      return res.status(404).json({ error: 'Display not found' });
    }

    // Calculate real-time status
    const calculatedStatus = calculateDisplayStatus(display);

    res.json({
      id: display.id,
      pairingCode: display.pairingCode,
      status: calculatedStatus,
      isPaired: display.isPaired,
      deviceToken: display.deviceToken || null,
    });
  } catch (error) {
    console.error('Get Display Status Error:', error);
    res.status(500).json({ error: 'Failed to get display status', details: error.message });
  }
};

/**
 * POST /api/displays/:id/heartbeat
 * Update display heartbeat (called by the device)
 */
exports.updateHeartbeat = async (req, res) => {
  try {
    const { id } = req.params;
    const deviceToken = req.headers.authorization?.split(' ')[1];

    if (!deviceToken) {
      return res.status(401).json({ error: 'Device token required' });
    }

    // Verify device token
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(deviceToken, process.env.JWT_SECRET || 'default_secret');
    } catch (error) {
      return res.status(401).json({ error: 'Invalid device token' });
    }

    if (decoded.displayId !== id) {
      return res.status(403).json({ error: 'Token does not match display' });
    }

    // Update heartbeat
    const display = await prisma.display.update({
      where: { id },
      data: {
        lastHeartbeat: new Date(),
        lastSeenAt: new Date(),
        status: 'ONLINE',
      },
    });

    res.json({ 
      success: true, 
      lastHeartbeat: display.lastHeartbeat,
      status: display.status,
      kioskModeEnabled: display.kioskModeEnabled !== false, // Default true, can be disabled remotely
    });
  } catch (error) {
    console.error('Update Heartbeat Error:', error);
    res.status(500).json({ error: 'Failed to update heartbeat', details: error.message });
  }
};

/**
 * PATCH /api/displays/:id/kiosk-mode
 * Toggle kiosk mode for a display (remote kill switch)
 */
exports.toggleKioskMode = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const user = req.user;

    const display = await prisma.display.findUnique({
      where: { id },
    });

    if (!display) {
      return res.status(404).json({ error: 'Display not found' });
    }

    // Check permissions (same as update display)
    if (user.role === 'SUPER_ADMIN') {
      // Super Admin can control any display
    } else if (user.role === 'CLIENT_ADMIN') {
      if (display.clientAdminId && display.clientAdminId.toString() !== user.id.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (user.role === 'USER_ADMIN') {
      if (!display.managedByUserId || display.managedByUserId.toString() !== user.id.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedDisplay = await prisma.display.update({
      where: { id },
      data: {
        kioskModeEnabled: enabled !== false, // Default to true
      },
    });

    res.json({
      success: true,
      kioskModeEnabled: updatedDisplay.kioskModeEnabled,
      message: enabled ? 'Kiosk mode enabled' : 'Kiosk mode disabled - device will exit on next heartbeat',
    });
  } catch (error) {
    console.error('Toggle Kiosk Mode Error:', error);
    res.status(500).json({ error: 'Failed to toggle kiosk mode', details: error.message });
  }
};

/**
 * Clean up orphaned displays that have been in pairing mode for more than 24 hours
 * This prevents the database from accumulating unused pairing codes
 */
async function cleanupOrphanedDisplays() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await prisma.display.deleteMany({
      where: {
        isPaired: false,
        status: 'PAIRING',
        createdAt: {
          lt: twentyFourHoursAgo
        }
      }
    });

    if (result.count > 0) {
      console.log(`🧹 Cleaned up ${result.count} orphaned displays`);
    }
  } catch (error) {
    console.error('Error cleaning up orphaned displays:', error);
  }
}
