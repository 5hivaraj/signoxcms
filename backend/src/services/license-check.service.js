const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

let cronJob = null;

/**
 * Check and suspend expired licenses
 * Runs every hour to check for expired licenses
 */
const checkExpiredLicenses = async () => {
  try {
    console.log('🔍 Checking for expired licenses...');

    const now = new Date();

    // Find all client profiles with expired licenses that are still active
    const expiredProfiles = await prisma.clientProfile.findMany({
      where: {
        isActive: true,
        licenseExpiry: {
          lt: now, // License expiry is less than current time
        },
      },
      include: {
        clientAdmin: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (expiredProfiles.length === 0) {
      console.log('✅ No expired licenses found');
      return;
    }

    console.log(`⚠️  Found ${expiredProfiles.length} expired license(s)`);

    // Suspend each expired client profile
    for (const profile of expiredProfiles) {
      try {
        // Update client profile to inactive
        await prisma.clientProfile.update({
          where: { id: profile.id },
          data: { isActive: false },
        });

        console.log(`🔒 Suspended license for client: ${profile.clientAdmin.email} (${profile.clientId})`);
        console.log(`   License expired on: ${profile.licenseExpiry}`);
        console.log(`   Company: ${profile.companyName || 'N/A'}`);

        // Optionally: Send notification email to client admin
        // await sendLicenseExpiredEmail(profile.clientAdmin.email, profile);

      } catch (error) {
        console.error(`❌ Failed to suspend license for client ${profile.clientId}:`, error.message);
      }
    }

    console.log(`✅ License check completed. Suspended ${expiredProfiles.length} expired license(s)`);

  } catch (error) {
    console.error('❌ Error checking expired licenses:', error);
  }
};

/**
 * Start the license check cron job
 * Runs every hour at minute 0
 */
const start = () => {
  if (cronJob) {
    console.log('⚠️  License check service already running');
    return;
  }

  // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
  cronJob = cron.schedule('0 * * * *', async () => {
    await checkExpiredLicenses();
  });

  console.log('🚀 License check service started (runs every hour)');

  // Run immediately on startup
  checkExpiredLicenses();
};

/**
 * Stop the license check cron job
 */
const stop = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('🛑 License check service stopped');
  }
};

/**
 * Manually trigger license check (for testing or admin actions)
 */
const checkNow = async () => {
  console.log('🔄 Manual license check triggered');
  await checkExpiredLicenses();
};

module.exports = {
  start,
  stop,
  checkNow,
};
