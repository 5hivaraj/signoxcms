const prisma = require('../config/db');

/**
 * Get the client admin ID for a given user
 * @param {string} userId - The user ID
 * @returns {Promise<string|null>} - The client admin ID or null
 */
async function getClientAdminId(userId) {
  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        managedByClientAdmin: true,
        createdByUserAdmin: {
          select: {
            id: true,
            managedByClientAdminId: true
          }
        }
      }
    });

    if (!user) {
      console.warn('User not found for ID:', userId);
      return null;
    }

    // If user is a CLIENT_ADMIN, return their own ID
    if (user.role === 'CLIENT_ADMIN') {
      return user.id;
    }

    // If user is managed by a client admin (USER_ADMIN case), return the client admin's ID
    if (user.managedByClientAdminId) {
      return user.managedByClientAdminId;
    }

    // If user is STAFF, traverse through their User Admin to find the Client Admin
    if (user.role === 'STAFF') {
      if (user.createdByUserAdminId && user.createdByUserAdmin) {
        // Use the included data if available
        if (user.createdByUserAdmin.managedByClientAdminId) {
          return user.createdByUserAdmin.managedByClientAdminId;
        }
      } else if (user.createdByUserAdminId) {
        // Fallback: fetch the User Admin separately if include didn't work
        const userAdmin = await prisma.user.findUnique({
          where: { id: user.createdByUserAdminId },
          select: { managedByClientAdminId: true }
        });
        if (userAdmin?.managedByClientAdminId) {
          return userAdmin.managedByClientAdminId;
        }
      } else {
        console.warn('STAFF user has no createdByUserAdminId:', userId);
      }
    }

    // USER_ADMIN fallback: if managedByClientAdminId is missing, find client admin who has this user in userAdmins
    if (user.role === 'USER_ADMIN') {
      const clientAdmin = await prisma.user.findFirst({
        where: {
          role: 'CLIENT_ADMIN',
          userAdmins: { some: { id: userId } }
        },
        select: { id: true }
      });
      if (clientAdmin) return clientAdmin.id;
    }

    console.warn('Unable to determine client admin ID for user:', {
      userId,
      role: user.role,
      staffRole: user.staffRole,
      managedByClientAdminId: user.managedByClientAdminId,
      createdByUserAdminId: user.createdByUserAdminId
    });
    return null;
  } catch (error) {
    console.error('Error in getClientAdminId:', error);
    return null;
  }
}

/**
 * Calculate total media storage used by a client (in bytes)
 * @param {string} clientAdminId - The client admin ID
 * @returns {Promise<number>} - Total storage used in bytes
 */
async function calculateClientStorageUsage(clientAdminId) {
  if (!clientAdminId) return 0;

  // Get all USER_ADMINs under this client admin
  const userAdmins = await prisma.user.findMany({
    where: {
      role: 'USER_ADMIN',
      managedByClientAdminId: clientAdminId
    },
    select: { id: true }
  });

  const userAdminIds = userAdmins.map(ua => ua.id);

  // Get all STAFF users created by these USER_ADMINs
  const staffUsers = await prisma.user.findMany({
    where: {
      role: 'STAFF',
      createdByUserAdminId: {
        in: userAdminIds
      }
    },
    select: { id: true }
  });

  // Combine all user IDs: client admin + user admins + staff users
  const userIds = [
    clientAdminId,
    ...userAdminIds,
    ...staffUsers.map(s => s.id)
  ];

  if (userIds.length === 0) return 0;

  // Calculate total file size for all media created by these users
  const result = await prisma.media.aggregate({
    where: {
      createdById: {
        in: userIds
      }
    },
    _sum: {
      fileSize: true
    }
  });

  return result._sum.fileSize || 0;
}

/**
 * Check if monthly usage quota needs reset and reset if necessary
 * @param {string} clientAdminId - The client admin ID
 * @returns {Promise<boolean>} - true if reset occurred
 */
async function checkAndResetMonthlyQuota(clientAdminId) {
  if (!clientAdminId) return false;

  const clientProfile = await prisma.clientProfile.findUnique({
    where: { clientAdminId },
    select: { 
      usageQuotaResetDate: true, 
      billingDayOfMonth: true,
      monthlyUploadedBytes: true 
    }
  });

  if (!clientProfile) return false;

  const now = new Date();
  const lastReset = new Date(clientProfile.usageQuotaResetDate);
  const billingDay = clientProfile.billingDayOfMonth || 1;

  // Calculate next reset date based on billing day
  const nextResetDate = new Date(lastReset);
  nextResetDate.setMonth(nextResetDate.getMonth() + 1);
  
  // Handle edge case: if billing day doesn't exist in next month (e.g., Feb 30), use last day
  const maxDayInMonth = new Date(nextResetDate.getFullYear(), nextResetDate.getMonth() + 1, 0).getDate();
  nextResetDate.setDate(Math.min(billingDay, maxDayInMonth));

  // If we've passed the reset date, reset the quota
  if (now >= nextResetDate) {
    console.log(`🔄 Resetting monthly quota for client ${clientAdminId}`);
    await prisma.clientProfile.update({
      where: { clientAdminId },
      data: {
        monthlyUploadedBytes: 0,
        usageQuotaResetDate: now
      }
    });
    return true;
  }

  return false;
}

/**
 * Increment monthly upload counter
 * @param {string} clientAdminId - The client admin ID
 * @param {number} bytes - Bytes to add to monthly counter
 */
async function incrementMonthlyUpload(clientAdminId, bytes) {
  if (!clientAdminId || !bytes) return;

  await prisma.clientProfile.update({
    where: { clientAdminId },
    data: {
      monthlyUploadedBytes: {
        increment: bytes
      }
    }
  });
  console.log(`📊 Incremented monthly upload for client ${clientAdminId} by ${bytes} bytes`);
}

/**
 * Get client storage limits and usage (both storage and monthly usage)
 * @param {string} clientAdminId - The client admin ID
 * @returns {Promise<{limitMB: number, usedBytes: number, usedMB: number, availableBytes: number, availableMB: number, maxMonthlyUsageMB: number, monthlyUploadedBytes: number, monthlyUploadedMB: number, monthlyQuotaRemainingBytes: number, monthlyQuotaRemainingMB: number, quotaResetDate: Date}>}
 */
async function getClientStorageInfo(clientAdminId) {
  if (!clientAdminId) {
    return {
      limitMB: 0,
      usedBytes: 0,
      usedMB: 0,
      availableBytes: 0,
      availableMB: 0,
      maxMonthlyUsageMB: 0,
      monthlyUploadedBytes: 0,
      monthlyUploadedMB: 0,
      monthlyQuotaRemainingBytes: 0,
      monthlyQuotaRemainingMB: 0,
      quotaResetDate: null
    };
  }

  // Check and reset quota if needed
  await checkAndResetMonthlyQuota(clientAdminId);

  // Get client profile to find storage and usage limits
  const clientProfile = await prisma.clientProfile.findUnique({
    where: { clientAdminId },
    select: { 
      maxStorageMB: true,
      maxMonthlyUsageMB: true,
      monthlyUploadedBytes: true,
      usageQuotaResetDate: true,
      billingDayOfMonth: true
    }
  });

  // Storage limits (disk space)
  const limitMB = clientProfile?.maxStorageMB || 25;
  const limitBytes = limitMB * 1024 * 1024;

  const usedBytes = await calculateClientStorageUsage(clientAdminId);
  const usedMB = Math.round((usedBytes / (1024 * 1024)) * 100) / 100;

  const availableBytes = Math.max(0, limitBytes - usedBytes);
  const availableMB = Math.round((availableBytes / (1024 * 1024)) * 100) / 100;

  // Monthly usage limits (bandwidth/transfer quota)
  const maxMonthlyUsageMB = clientProfile?.maxMonthlyUsageMB || 150;
  const maxMonthlyUsageBytes = maxMonthlyUsageMB * 1024 * 1024;

  // Convert BigInt to number for calculations and JSON serialization
  const monthlyUploadedBytes = Number(clientProfile?.monthlyUploadedBytes || 0);
  const monthlyUploadedMB = Math.round((monthlyUploadedBytes / (1024 * 1024)) * 100) / 100;

  const monthlyQuotaRemainingBytes = Math.max(0, maxMonthlyUsageBytes - monthlyUploadedBytes);
  const monthlyQuotaRemainingMB = Math.round((monthlyQuotaRemainingBytes / (1024 * 1024)) * 100) / 100;

  // Calculate next reset date
  const lastReset = new Date(clientProfile?.usageQuotaResetDate || new Date());
  const billingDay = clientProfile?.billingDayOfMonth || 1;
  const nextResetDate = new Date(lastReset);
  nextResetDate.setMonth(nextResetDate.getMonth() + 1);
  const maxDayInMonth = new Date(nextResetDate.getFullYear(), nextResetDate.getMonth() + 1, 0).getDate();
  nextResetDate.setDate(Math.min(billingDay, maxDayInMonth));

  return {
    // Storage (disk space)
    limitMB,
    usedBytes,
    usedMB,
    availableBytes,
    availableMB,
    // Monthly usage (bandwidth/transfer)
    maxMonthlyUsageMB,
    monthlyUploadedBytes,
    monthlyUploadedMB,
    monthlyQuotaRemainingBytes,
    monthlyQuotaRemainingMB,
    quotaResetDate: nextResetDate
  };
}

/**
 * Check if a client can upload a file of given size
 * Checks BOTH storage limit (disk space) AND monthly usage quota
 * @param {string} userId - The user ID attempting to upload
 * @param {number} fileSizeBytes - The size of the file to upload in bytes
 * @returns {Promise<{canUpload: boolean, reason?: string, storageInfo: object}>}
 */
async function checkStorageLimit(userId, fileSizeBytes) {
  const clientAdminId = await getClientAdminId(userId);
  
  if (!clientAdminId) {
    return {
      canUpload: false,
      reason: 'Unable to determine client association',
      storageInfo: null
    };
  }

  const storageInfo = await getClientStorageInfo(clientAdminId);
  const fileSizeMB = Math.round((fileSizeBytes / (1024 * 1024)) * 100) / 100;

  // CHECK 1: Current storage on disk (can we fit this file?)
  if (fileSizeBytes > storageInfo.availableBytes) {
    return {
      canUpload: false,
      reason: `Storage limit exceeded. File size (${fileSizeMB}MB) exceeds available storage (${storageInfo.availableMB}MB). Total storage limit: ${storageInfo.limitMB}MB, currently used: ${storageInfo.usedMB}MB. Please delete some files to free up space.`,
      storageInfo
    };
  }

  // CHECK 2: Monthly usage quota (have we uploaded too much this month?)
  if (fileSizeBytes > storageInfo.monthlyQuotaRemainingBytes) {
    const resetDate = storageInfo.quotaResetDate ? storageInfo.quotaResetDate.toLocaleDateString() : 'next billing cycle';
    return {
      canUpload: false,
      reason: `Monthly usage quota exceeded. File size (${fileSizeMB}MB) exceeds remaining monthly quota (${storageInfo.monthlyQuotaRemainingMB}MB). Monthly limit: ${storageInfo.maxMonthlyUsageMB}MB, used this month: ${storageInfo.monthlyUploadedMB}MB. Quota resets on ${resetDate}.`,
      storageInfo
    };
  }

  return {
    canUpload: true,
    storageInfo
  };
}

module.exports = {
  getClientAdminId,
  calculateClientStorageUsage,
  getClientStorageInfo,
  checkStorageLimit,
  incrementMonthlyUpload,
  checkAndResetMonthlyQuota
};