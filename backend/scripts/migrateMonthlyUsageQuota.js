/**
 * Migration script to add monthly usage quota fields to existing ClientProfiles
 * Run this after updating the Prisma schema
 */

const prisma = require('../src/config/db');

async function migrateMonthlyUsageQuota() {
  console.log('🔄 Starting monthly usage quota migration...\n');

  try {
    // Get all client profiles
    const clientProfiles = await prisma.clientProfile.findMany({
      select: {
        id: true,
        clientAdminId: true,
        maxStorageMB: true,
        companyName: true
      }
    });

    console.log(`📊 Found ${clientProfiles.length} client profiles to migrate\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const profile of clientProfiles) {
      try {
        // Calculate current storage usage for this client
        const userAdmins = await prisma.user.findMany({
          where: {
            role: 'USER_ADMIN',
            managedByClientAdminId: profile.clientAdminId
          },
          select: { id: true }
        });

        const userAdminIds = userAdmins.map(ua => ua.id);

        const staffUsers = await prisma.user.findMany({
          where: {
            role: 'STAFF',
            createdByUserAdminId: {
              in: userAdminIds
            }
          },
          select: { id: true }
        });

        const userIds = [
          profile.clientAdminId,
          ...userAdminIds,
          ...staffUsers.map(s => s.id)
        ];

        // Calculate total file size for all media
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

        const currentStorageBytes = result._sum.fileSize || 0;
        const currentStorageMB = Math.round((currentStorageBytes / (1024 * 1024)) * 100) / 100;

        // Set maxMonthlyUsageMB to 6x storage limit (default multiplier)
        const maxMonthlyUsageMB = profile.maxStorageMB * 6;

        // Set monthlyUploadedBytes to current storage (conservative approach)
        // This ensures existing clients don't immediately hit limits
        const monthlyUploadedBytes = currentStorageBytes;

        // Update the client profile
        await prisma.clientProfile.update({
          where: { id: profile.id },
          data: {
            maxMonthlyUsageMB,
            monthlyUploadedBytes,
            usageQuotaResetDate: new Date(),
            billingDayOfMonth: 1
          }
        });

        console.log(`✅ ${profile.companyName || profile.clientAdminId}:`);
        console.log(`   - Storage Limit: ${profile.maxStorageMB}MB`);
        console.log(`   - Monthly Usage Limit: ${maxMonthlyUsageMB}MB (6x storage)`);
        console.log(`   - Current Storage: ${currentStorageMB}MB`);
        console.log(`   - Initial Monthly Usage: ${currentStorageMB}MB`);
        console.log(`   - Billing Day: 1st of month\n`);

        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating ${profile.companyName || profile.clientAdminId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${clientProfiles.length}\n`);

    console.log('✅ Migration completed!\n');
    console.log('📝 Next steps:');
    console.log('   1. Run: npx prisma generate');
    console.log('   2. Restart your backend server');
    console.log('   3. Verify storage info displays correctly in the UI\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateMonthlyUsageQuota()
  .then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
