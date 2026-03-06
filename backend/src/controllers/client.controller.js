const prisma = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * Generate a unique client ID
 */
async function generateClientId() {
  let clientId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    // Generate format: CL-XXXXXX (6 random alphanumeric characters)
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    clientId = `CL-${randomPart}`;
    
    // Check if this ID already exists
    const existing = await prisma.clientProfile.findUnique({
      where: { clientId }
    });
    
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Unable to generate unique client ID after maximum attempts');
  }

  return clientId;
}

/**
 * POST /api/users/client-admin
 * Create a new Client Admin + linked ClientProfile (commercial constraints)
 */
exports.createClientAdmin = async (req, res) => {
  try {
    const {
      name, // optional display name / company contact name (not stored yet)
      email,
      password,
      companyName,
      maxDisplays,
      maxUsers,
      maxStorageMB,
      maxMonthlyUsageMB,
      licenseExpiry,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    if (!companyName) {
      return res.status(400).json({ message: 'Company name required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: passwordHash,
          role: 'CLIENT_ADMIN',
          isActive: true,
        },
      });

      // Generate unique client ID
      const clientId = await generateClientId();

      const profile = await tx.clientProfile.create({
        data: {
          clientAdminId: user.id,
          clientId,
          companyName,
          maxDisplays: Number.isFinite(Number(maxDisplays)) ? Number(maxDisplays) : 10,
          maxUsers: Number.isFinite(Number(maxUsers)) ? Number(maxUsers) : 5,
          maxStorageMB: Number.isFinite(Number(maxStorageMB)) ? Number(maxStorageMB) : 25,
          maxMonthlyUsageMB: Number.isFinite(Number(maxMonthlyUsageMB)) ? Number(maxMonthlyUsageMB) : 150,
          licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
          isActive: true,
          contactEmail: email,
        },
      });

      return { user, profile };
    });

    // Convert BigInt to number for JSON serialization
    const profileForResponse = {
      ...created.profile,
      monthlyUploadedBytes: Number(created.profile.monthlyUploadedBytes || 0)
    };

    res.status(201).json({
      message: 'Client Admin created',
      clientAdmin: {
        id: created.user.id,
        email: created.user.email,
        role: created.user.role,
        isActive: created.user.isActive,
        clientProfile: profileForResponse,
      },
      // keep name in response for UI even though not stored
      name: name || null,
    });
  } catch (error) {
    console.error('Create Client Admin Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/users/client-admins
 * List all Client Admin users + their ClientProfile and display usage.
 */
exports.listClientAdmins = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'CLIENT_ADMIN' },
      orderBy: { createdAt: 'desc' },
      include: { clientProfile: true },
    });

    const now = new Date();

    const withUsage = await Promise.all(
      users.map(async (u) => {
        const displaysUsed = await prisma.display.count({
          where: { clientAdminId: u.id },
        });

        // Calculate license status
        let licenseStatus = 'active';
        let daysUntilExpiry = null;
        let isExpired = false;

        if (u.clientProfile) {
          // Check if profile is inactive
          if (!u.clientProfile.isActive) {
            licenseStatus = 'suspended';
          } 
          // Check if license has expired
          else if (u.clientProfile.licenseExpiry) {
            const expiryDate = new Date(u.clientProfile.licenseExpiry);
            isExpired = expiryDate < now;
            daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

            if (isExpired) {
              licenseStatus = 'expired';
            } else if (daysUntilExpiry <= 7) {
              licenseStatus = 'expiring_soon';
            }
          }
        }

        // Convert BigInt fields to numbers for JSON serialization
        const clientProfile = u.clientProfile ? {
          ...u.clientProfile,
          monthlyUploadedBytes: u.clientProfile.monthlyUploadedBytes 
            ? Number(u.clientProfile.monthlyUploadedBytes) 
            : 0
        } : null;

        return {
          id: u.id,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt,
          clientProfile,
          displaysUsed,
          licenseStatus,
          daysUntilExpiry,
          isExpired,
        };
      })
    );

    res.json({
      clientAdmins: withUsage,
    });
  } catch (error) {
    console.error('List Client Admins Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * PATCH /api/users/client-admins/:id/status
 * Toggle isActive for a tenant (suspend/activate)
 * Cascades to all User Admins and Staff under this Client Admin
 */
exports.toggleClientAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔄 Toggle Client Admin Status Request:', {
      clientAdminId: id,
      requestedBy: req.user?.email,
      requestedByRole: req.user?.role,
      requestedById: req.user?.id
    });

    if (!id) {
      console.error('❌ Toggle status: No client admin ID provided');
      return res.status(400).json({ message: 'Client Admin ID required' });
    }

    // Prevent super admin from suspending themselves (if they somehow have a client profile)
    if (id === req.user.id) {
      console.error('❌ Toggle status: Cannot suspend yourself');
      return res.status(400).json({ message: 'Cannot suspend your own account' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== 'CLIENT_ADMIN') {
      console.error('❌ Toggle status: Client Admin not found', { id });
      return res.status(404).json({ message: 'Client Admin not found' });
    }

    const newStatus = !user.isActive;
    console.log(`🔄 Changing status from ${user.isActive} to ${newStatus} for ${user.email}`);

    // Use transaction to update Client Admin and all related users
    await prisma.$transaction(async (tx) => {
      // 1. Update the Client Admin
      await tx.user.update({
        where: { id },
        data: { isActive: newStatus },
      });

      // 2. Update Client Profile
      const profile = await tx.clientProfile.findUnique({
        where: { clientAdminId: id },
      });

      if (profile) {
        await tx.clientProfile.update({
          where: { id: profile.id },
          data: { isActive: newStatus },
        });
      }

      // 3. Update all User Admins managed by this Client Admin
      await tx.user.updateMany({
        where: {
          role: 'USER_ADMIN',
          managedByClientAdminId: id,
        },
        data: { isActive: newStatus },
      });

      // 4. Find all User Admins under this Client Admin
      const userAdmins = await tx.user.findMany({
        where: {
          role: 'USER_ADMIN',
          managedByClientAdminId: id,
        },
        select: { id: true },
      });

      // 5. Update all Staff created by those User Admins
      if (userAdmins.length > 0) {
        const userAdminIds = userAdmins.map(ua => ua.id);
        await tx.user.updateMany({
          where: {
            role: 'STAFF',
            createdByUserAdminId: { in: userAdminIds },
          },
          data: { isActive: newStatus },
        });
      }
    });

    // Fetch updated data to return
    const updated = await prisma.user.findUnique({
      where: { id },
      include: { clientProfile: true },
    });

    console.log(`✅ Client Admin ${newStatus ? 'activated' : 'suspended'}: ${updated.email}`);
    console.log(`   Cascaded status to all User Admins and Staff under this client`);

    res.json({
      clientAdmin: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        clientProfile: updated.clientProfile,
      },
      message: `Client Admin ${newStatus ? 'activated' : 'suspended'} successfully. All related users have been ${newStatus ? 'activated' : 'suspended'}.`,
    });
  } catch (error) {
    console.error('❌ Toggle Client Admin Status Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * PUT /api/users/client-admins/:id
 * Update client admin limits and settings
 */
exports.updateClientAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      companyName,
      maxDisplays,
      maxUsers,
      maxStorageMB,
      maxMonthlyUsageMB,
      licenseExpiry,
      contactEmail,
      contactPhone,
    } = req.body;

    if (!id) return res.status(400).json({ message: 'Client Admin ID required' });

    // Verify the user exists and is a CLIENT_ADMIN
    const user = await prisma.user.findUnique({ 
      where: { id },
      include: { clientProfile: true }
    });
    
    if (!user || user.role !== 'CLIENT_ADMIN') {
      return res.status(404).json({ message: 'Client Admin not found' });
    }

    if (!user.clientProfile) {
      return res.status(404).json({ message: 'Client profile not found' });
    }

    // Check if reducing maxDisplays would violate current usage
    if (maxDisplays !== undefined) {
      const currentDisplayCount = await prisma.display.count({
        where: { clientAdminId: id }
      });

      if (Number(maxDisplays) < currentDisplayCount) {
        return res.status(400).json({ 
          message: `Cannot reduce display limit to ${maxDisplays}. Client currently has ${currentDisplayCount} displays. Please remove displays first.` 
        });
      }
    }

    // Check if reducing maxUsers would violate current usage
    if (maxUsers !== undefined) {
      const currentUserCount = await prisma.user.count({
        where: { managedByClientAdminId: id }
      });

      if (Number(maxUsers) < currentUserCount) {
        return res.status(400).json({ 
          message: `Cannot reduce user limit to ${maxUsers}. Client currently has ${currentUserCount} users. Please remove users first.` 
        });
      }
    }

    // Update the client profile
    const updatedProfile = await prisma.clientProfile.update({
      where: { clientAdminId: id },
      data: {
        ...(companyName !== undefined && { companyName }),
        ...(maxDisplays !== undefined && { maxDisplays: Number(maxDisplays) }),
        ...(maxUsers !== undefined && { maxUsers: Number(maxUsers) }),
        ...(maxStorageMB !== undefined && { maxStorageMB: Number(maxStorageMB) }),
        ...(maxMonthlyUsageMB !== undefined && { maxMonthlyUsageMB: Number(maxMonthlyUsageMB) }),
        ...(licenseExpiry !== undefined && { 
          licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null 
        }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(contactPhone !== undefined && { contactPhone }),
      },
    });

    // Return updated client admin with profile
    const updatedClientAdmin = await prisma.user.findUnique({
      where: { id },
      include: { clientProfile: true }
    });

    // Convert BigInt to number for JSON serialization
    const profileForResponse = updatedClientAdmin.clientProfile ? {
      ...updatedClientAdmin.clientProfile,
      monthlyUploadedBytes: Number(updatedClientAdmin.clientProfile.monthlyUploadedBytes || 0)
    } : null;

    res.json({
      message: 'Client Admin updated successfully',
      clientAdmin: {
        id: updatedClientAdmin.id,
        email: updatedClientAdmin.email,
        role: updatedClientAdmin.role,
        isActive: updatedClientAdmin.isActive,
        createdAt: updatedClientAdmin.createdAt,
        clientProfile: profileForResponse,
      },
    });
  } catch (error) {
    console.error('Update Client Admin Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * DELETE /api/users/client-admins/:id
 * Delete a client admin and all associated data
 */
exports.deleteClientAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Client Admin ID required' });

    // Verify the user exists and is a CLIENT_ADMIN
    const user = await prisma.user.findUnique({ 
      where: { id },
      include: { 
        clientProfile: true
      }
    });
    
    if (!user || user.role !== 'CLIENT_ADMIN') {
      return res.status(404).json({ message: 'Client Admin not found' });
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // 1. Get all user admins under this client
      const userAdmins = await tx.user.findMany({
        where: { managedByClientAdminId: id },
        select: { id: true }
      });
      const userAdminIds = userAdmins.map(u => u.id);

      // 2. Get all staff users created by these user admins
      const staffUsers = userAdminIds.length > 0 ? await tx.user.findMany({
        where: { createdByUserAdminId: { in: userAdminIds } },
        select: { id: true }
      }) : [];
      const staffUserIds = staffUsers.map(u => u.id);

      // 3. All user IDs to delete (user admins + staff)
      const allUserIds = [...userAdminIds, ...staffUserIds];

      // 4. Collect playlist/layout IDs created by these users (used for deep cleanup)
      const playlists = allUserIds.length > 0 ? await tx.playlist.findMany({
        where: { createdById: { in: allUserIds } },
        select: { id: true }
      }) : [];
      const playlistIds = playlists.map(p => p.id);

      const layouts = allUserIds.length > 0 ? await tx.layout.findMany({
        where: { createdById: { in: allUserIds } },
        select: { id: true }
      }) : [];
      const layoutIds = layouts.map(l => l.id);

      // 5. Delete playlist items for playlists created by these users
      if (allUserIds.length > 0) {
        if (playlistIds.length > 0) {
          await tx.playlistItem.deleteMany({
            where: { playlistId: { in: playlistIds } }
          });
        }
      }

      // 6. Delete deep layout children BEFORE deleting layouts/media
      // Layouts contain: widgets, sections->sectionItems, zones, layoutZones (which may reference playlists)
      if (layoutIds.length > 0) {
        // 6a. Delete widgets
        await tx.widget.deleteMany({
          where: { layoutId: { in: layoutIds } }
        });

        // 6b. Delete layout section items -> then sections
        const sections = await tx.layoutSection.findMany({
          where: { layoutId: { in: layoutIds } },
          select: { id: true }
        });
        const sectionIds = sections.map(s => s.id);

        if (sectionIds.length > 0) {
          await tx.layoutSectionItem.deleteMany({
            where: { sectionId: { in: sectionIds } }
          });
        }

        await tx.layoutSection.deleteMany({
          where: { layoutId: { in: layoutIds } }
        });

        // 6c. Delete zones and template layout zones
        await tx.zone.deleteMany({
          where: { layoutId: { in: layoutIds } }
        });

        await tx.layoutZone.deleteMany({
          where: { layoutId: { in: layoutIds } }
        });
      }

      // 7. Delete schedule-display relationships and schedules created by these users
      if (allUserIds.length > 0) {
        // First get all schedules created by these users
        const schedules = await tx.schedule.findMany({
          where: { createdById: { in: allUserIds } },
          select: { id: true }
        });
        const scheduleIds = schedules.map(s => s.id);

        // Delete schedule-display relationships
        if (scheduleIds.length > 0) {
          await tx.scheduleDisplay.deleteMany({
            where: { scheduleId: { in: scheduleIds } }
          });
        }

        // Delete schedules
        await tx.schedule.deleteMany({
          where: { createdById: { in: allUserIds } }
        });
      }

      // 8. Unassign playlists/layouts from displays before deletion (including activeLayoutId)
      await tx.display.updateMany({
        where: { clientAdminId: id },
        data: { 
          playlistId: null,
          layoutId: null,
          activeLayoutId: null,
          managedByUserId: null
        }
      });

      // Also unassign displays managed by user admins being deleted
      if (allUserIds.length > 0) {
        await tx.display.updateMany({
          where: { managedByUserId: { in: allUserIds } },
          data: { 
            playlistId: null,
            layoutId: null,
            activeLayoutId: null,
            managedByUserId: null
          }
        });
      }

      // 9. Delete playlists created by users in this client
      if (allUserIds.length > 0) {
        await tx.playlist.deleteMany({
          where: { createdById: { in: allUserIds } }
        });
      }

      // 10. Delete layouts created by users in this client
      if (allUserIds.length > 0) {
        await tx.layout.deleteMany({
          where: { createdById: { in: allUserIds } }
        });
      }

      // 11. Delete media created by users in this client
      if (allUserIds.length > 0) {
        await tx.media.deleteMany({
          where: { createdById: { in: allUserIds } }
        });
      }

      // 12. Delete schedule-display rows tied to displays we are about to delete (safety)
      // (Schedules can be created by various users; the join table can block display deletion.)
      await tx.scheduleDisplay.deleteMany({
        where: {
          displayId: {
            in: (await tx.display.findMany({
              where: { clientAdminId: id },
              select: { id: true }
            })).map(d => d.id)
          }
        }
      });

      // 13. Delete all displays owned by this client
      await tx.display.deleteMany({
        where: { clientAdminId: id }
      });

      // 14. Delete STAFF users first (to avoid relation constraint violation)
      if (staffUserIds.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: staffUserIds } }
        });
      }

      // 15. Delete USER_ADMIN users (after staff are deleted)
      if (userAdminIds.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: userAdminIds } }
        });
      }

      // 16. Delete the client profile
      if (user.clientProfile) {
        await tx.clientProfile.delete({
          where: { clientAdminId: id }
        });
      }

      // 17. Finally, delete the client admin user
      await tx.user.delete({
        where: { id }
      });
    });

    res.json({
      message: 'Client Admin and all associated data deleted successfully',
      deletedClientId: user.clientProfile?.clientId,
      deletedCompanyName: user.clientProfile?.companyName,
    });
  } catch (error) {
    console.error('Delete Client Admin Error:', error);
    
    // More detailed error logging
    if (error.code) {
      console.error('Prisma Error Code:', error.code);
    }
    if (error.meta) {
      console.error('Prisma Error Meta:', error.meta);
    }
    
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

