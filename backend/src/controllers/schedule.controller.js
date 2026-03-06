const prisma = require('../config/db');

/**
 * GET /api/schedules
 * Get all schedules for the authenticated user
 */
exports.getSchedules = async (req, res) => {
  try {
    const user = req.user;
    let whereClause = {};

    // Filter schedules based on user role
    if (user.role === 'SUPER_ADMIN') {
      // Super admin can see all schedules
    } else if (user.role === 'CLIENT_ADMIN') {
      // Client admin can see schedules for displays they own
      whereClause = {
        displays: {
          some: {
            display: {
              clientAdminId: user.id
            }
          }
        }
      };
    } else if (user.role === 'USER_ADMIN') {
      // User admin can see schedules they created or for displays they manage
      whereClause = {
        OR: [
          { createdById: user.id },
          {
            displays: {
              some: {
                display: {
                  managedByUserId: user.id
                }
              }
            }
          }
        ]
      };
    } else if (user.role === 'STAFF') {
      // Staff (e.g. BROADCAST_MANAGER) see schedules they created or on displays managed by their User Admin
      const staffUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { createdByUserAdminId: true }
      });
      const userAdminId = staffUser?.createdByUserAdminId;
      if (userAdminId) {
        whereClause = {
          OR: [
            { createdById: user.id },
            {
              displays: {
                some: {
                  display: {
                    managedByUserId: userAdminId
                  }
                }
              }
            }
          ]
        };
      } else {
        whereClause = { createdById: user.id };
      }
    } else {
      whereClause = { createdById: user.id };
    }

    const schedules = await prisma.schedule.findMany({
      where: whereClause,
      include: {
        playlist: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        layout: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        displays: {
          include: {
            display: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ schedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ message: 'Failed to fetch schedules', error: error.message });
  }
};

/**
 * POST /api/schedules
 * Create a new schedule
 */
exports.createSchedule = async (req, res) => {
  try {
    const user = req.user;
    const {
      name,
      description,
      startTime,
      endTime,
      timezone = 'Asia/Kolkata', // Default to India timezone
      repeatDays,
      startDate,
      endDate,
      priority = 1,
      playlistId,
      layoutId,
      displayIds,
      orientation
    } = req.body;

    console.log('Creating schedule for user:', { userId: user.id, role: user.role, displayIds });

    // Validation
    if (!name || !startTime || !endTime) {
      return res.status(400).json({
        message: 'Missing required fields: name, startTime, endTime'
      });
    }
    if (!Array.isArray(repeatDays) || repeatDays.length === 0) {
      return res.status(400).json({
        message: 'Select at least one repeat day'
      });
    }
    if (!Array.isArray(displayIds) || displayIds.length === 0) {
      return res.status(400).json({
        message: 'Select at least one display to assign this schedule to'
      });
    }

    if (!playlistId && !layoutId) {
      return res.status(400).json({
        message: 'Either playlistId or layoutId must be provided'
      });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({
        message: 'Invalid time format. Use HH:MM format (e.g., 09:00, 17:30)'
      });
    }

    // Validate repeat days
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const invalidDays = repeatDays.filter(day => !validDays.includes(day.toLowerCase()));
    if (invalidDays.length > 0) {
      return res.status(400).json({
        message: `Invalid days: ${invalidDays.join(', ')}. Valid days: ${validDays.join(', ')}`
      });
    }

    // Build display filter based on user role
    let displayFilter = { id: { in: displayIds } };
    
    if (user.role === 'USER_ADMIN') {
      displayFilter.managedByUserId = user.id;
    } else if (user.role === 'CLIENT_ADMIN') {
      displayFilter.clientAdminId = user.id;
    } else if (user.role === 'STAFF') {
      // Staff can only schedule on displays managed by their User Admin
      const staffUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { createdByUserAdminId: true }
      });
      
      if (!staffUser?.createdByUserAdminId) {
        return res.status(403).json({
          message: 'Staff user must be associated with a User Admin to create schedules'
        });
      }
      
      displayFilter.managedByUserId = staffUser.createdByUserAdminId;
    }
    // SUPER_ADMIN can schedule on any display, so no additional filter needed

    console.log('Display filter:', displayFilter);

    // Check if user has permission to schedule on these displays
    const displays = await prisma.display.findMany({
      where: displayFilter
    });

    console.log('Found displays:', displays.length, 'requested:', displayIds.length);

    if (displays.length !== displayIds.length) {
      const foundDisplayIds = displays.map(d => d.id);
      const missingDisplayIds = displayIds.filter(id => !foundDisplayIds.includes(id));
      
      return res.status(403).json({
        message: 'You do not have permission to schedule on some of the selected displays',
        missingDisplays: missingDisplayIds
      });
    }

    // Parse dates: endDate as date-only becomes end of that day so schedule is active all day
    const parsedStartDate = startDate ? new Date(startDate) : null;
    let parsedEndDate = null;
    if (endDate) {
      const d = new Date(endDate);
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) {
        d.setUTCHours(23, 59, 59, 999);
      }
      parsedEndDate = d;
    }

    // Create the schedule
    const schedule = await prisma.schedule.create({
      data: {
        name,
        description,
        startTime,
        endTime,
        timezone,
        repeatDays: repeatDays.map(day => day.toLowerCase()),
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        priority,
        playlistId,
        layoutId,
        orientation: orientation === 'LANDSCAPE' || orientation === 'PORTRAIT' ? orientation : undefined,
        createdById: user.id,
        displays: {
          create: displayIds.map(displayId => ({
            displayId
          }))
        }
      },
      include: {
        playlist: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        layout: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        displays: {
          include: {
            display: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    });

    console.log('Schedule created successfully:', schedule.id);
    res.status(201).json({ schedule, message: 'Schedule created successfully' });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ message: 'Failed to create schedule', error: error.message });
  }
};

/**
 * PUT /api/schedules/:id
 * Update a schedule
 */
exports.updateSchedule = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const {
      name,
      description,
      startTime,
      endTime,
      timezone,
      repeatDays,
      startDate,
      endDate,
      priority,
      playlistId,
      layoutId,
      displayIds,
      isActive,
      orientation
    } = req.body;

    // Check if schedule exists and user has permission
    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        displays: {
          include: {
            display: true
          }
        }
      }
    });

    if (!existingSchedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    // Check permissions: creator, or USER_ADMIN/STAFF who manage all displays on this schedule
    const isCreator = existingSchedule.createdById === user.id;
    let canUpdate = user.role === 'SUPER_ADMIN' || isCreator;
    if (!canUpdate && (user.role === 'USER_ADMIN' || user.role === 'STAFF')) {
      const displayList = existingSchedule.displays ?? [];
      let managedByMe = false;
      if (user.role === 'USER_ADMIN') {
        managedByMe = displayList.every(sd => sd.display?.managedByUserId === user.id);
      } else if (user.role === 'STAFF') {
        const staffUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { createdByUserAdminId: true }
        });
        managedByMe = displayList.every(sd => sd.display?.managedByUserId === staffUser?.createdByUserAdminId);
      }
      if (displayList.length > 0 && managedByMe) canUpdate = true;
    }
    if (!canUpdate) {
      return res.status(403).json({ message: 'You do not have permission to update this schedule' });
    }

    // Validate time format if provided
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (startTime && !timeRegex.test(startTime)) {
      return res.status(400).json({ message: 'Invalid startTime format. Use HH:MM format' });
    }
    if (endTime && !timeRegex.test(endTime)) {
      return res.status(400).json({ message: 'Invalid endTime format. Use HH:MM format' });
    }

    // Validate repeat days if provided
    if (repeatDays) {
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const invalidDays = repeatDays.filter(day => !validDays.includes(day.toLowerCase()));
      if (invalidDays.length > 0) {
        return res.status(400).json({
          message: `Invalid days: ${invalidDays.join(', ')}. Valid days: ${validDays.join(', ')}`
        });
      }
    }

    // Parse endDate: date-only becomes end of that day
    let parsedEndDateUpdate = undefined;
    if (endDate !== undefined) {
      if (!endDate) {
        parsedEndDateUpdate = null;
      } else {
        const d = new Date(endDate);
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) {
          d.setUTCHours(23, 59, 59, 999);
        }
        parsedEndDateUpdate = d;
      }
    }

    // Update schedule
    const updateData = {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
      ...(timezone && { timezone }),
      ...(repeatDays && { repeatDays: repeatDays.map(day => day.toLowerCase()) }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: parsedEndDateUpdate }),
      ...(priority !== undefined && { priority }),
      ...(playlistId !== undefined && { playlistId }),
      ...(layoutId !== undefined && { layoutId }),
      ...(isActive !== undefined && { isActive }),
      ...(orientation !== undefined && { orientation: orientation === 'LANDSCAPE' || orientation === 'PORTRAIT' ? orientation : undefined })
    };

    const schedule = await prisma.schedule.update({
      where: { id },
      data: updateData,
      include: {
        playlist: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        layout: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        displays: {
          include: {
            display: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    });

    // Update display assignments if provided
    if (displayIds) {
      // Remove existing assignments
      await prisma.scheduleDisplay.deleteMany({
        where: { scheduleId: id }
      });

      // Add new assignments
      await prisma.scheduleDisplay.createMany({
        data: displayIds.map(displayId => ({
          scheduleId: id,
          displayId
        }))
      });
    }

    res.json({ schedule, message: 'Schedule updated successfully' });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ message: 'Failed to update schedule', error: error.message });
  }
};

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
exports.deleteSchedule = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    // Check if schedule exists and user has permission
    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
      include: { displays: { include: { display: { select: { managedByUserId: true } } } } }
    });

    if (!existingSchedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    const isCreator = existingSchedule.createdById === user.id;
    let canDelete = user.role === 'SUPER_ADMIN' || isCreator;
    if (!canDelete && (user.role === 'USER_ADMIN' || user.role === 'STAFF')) {
      const displayList = existingSchedule.displays ?? [];
      let managedByMe = false;
      if (user.role === 'USER_ADMIN') {
        managedByMe = displayList.every(sd => sd.display?.managedByUserId === user.id);
      } else if (user.role === 'STAFF') {
        const staffUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { createdByUserAdminId: true }
        });
        managedByMe = displayList.every(sd => sd.display?.managedByUserId === staffUser?.createdByUserAdminId);
      }
      if (displayList.length > 0 && managedByMe) canDelete = true;
    }
    if (!canDelete) {
      return res.status(403).json({ message: 'You do not have permission to delete this schedule' });
    }

    // Delete schedule (cascade will handle ScheduleDisplay records)
    await prisma.schedule.delete({
      where: { id }
    });

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ message: 'Failed to delete schedule', error: error.message });
  }
};

/**
 * GET /api/schedules/active
 * Get currently active schedules for displays
 */
exports.getActiveSchedules = async (req, res) => {
  try {
    const { displayId, timezone = 'Asia/Kolkata' } = req.query; // Default to India timezone
    
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const currentDay = now.toLocaleDateString('en-US', { 
      weekday: 'long',
      timeZone: timezone
    }).toLowerCase();

    let whereClause = {
      isActive: true,
      repeatDays: {
        has: currentDay
      },
      startTime: {
        lte: currentTime
      },
      endTime: {
        gte: currentTime
      }
    };

    // Filter by display if specified
    if (displayId) {
      whereClause.displays = {
        some: {
          displayId: displayId
        }
      };
    }

    // Add date range filters
    whereClause.OR = [
      { startDate: null },
      { startDate: { lte: now } }
    ];
    
    whereClause.AND = [
      {
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ]
      }
    ];

    const activeSchedules = await prisma.schedule.findMany({
      where: whereClause,
      include: {
        playlist: {
          include: {
            items: {
              include: {
                media: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        },
        layout: {
          include: {
            widgets: true,
            sections: {
              include: {
                items: {
                  include: {
                    media: true
                  }
                }
              }
            }
          }
        },
        displays: {
          include: {
            display: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      },
      orderBy: {
        priority: 'desc'
      }
    });

    res.json({ 
      activeSchedules,
      currentTime,
      currentDay,
      timezone
    });
  } catch (error) {
    console.error('Get active schedules error:', error);
    res.status(500).json({ message: 'Failed to fetch active schedules', error: error.message });
  }
};