require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * List all client profiles with their license status
 */
async function listLicenses() {
  try {
    const profiles = await prisma.clientProfile.findMany({
      include: {
        clientAdmin: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        licenseExpiry: 'asc',
      },
    });

    console.log('\n📋 Client Licenses:\n');
    console.log('='.repeat(100));

    for (const profile of profiles) {
      const now = new Date();
      const isExpired = profile.licenseExpiry && new Date(profile.licenseExpiry) < now;
      const daysUntilExpiry = profile.licenseExpiry 
        ? Math.ceil((new Date(profile.licenseExpiry) - now) / (1000 * 60 * 60 * 24))
        : null;

      const status = !profile.isActive 
        ? '🔒 SUSPENDED' 
        : isExpired 
          ? '⚠️  EXPIRED' 
          : daysUntilExpiry !== null && daysUntilExpiry <= 7
            ? '⏰ EXPIRING SOON'
            : '✅ ACTIVE';

      console.log(`\nClient ID: ${profile.clientId}`);
      console.log(`Email: ${profile.clientAdmin.email}`);
      console.log(`Company: ${profile.companyName || 'N/A'}`);
      console.log(`Status: ${status}`);
      console.log(`Profile Active: ${profile.isActive ? 'Yes' : 'No'}`);
      console.log(`User Active: ${profile.clientAdmin.isActive ? 'Yes' : 'No'}`);
      console.log(`License Expiry: ${profile.licenseExpiry ? profile.licenseExpiry.toISOString() : 'No expiry set'}`);
      
      if (daysUntilExpiry !== null) {
        if (daysUntilExpiry < 0) {
          console.log(`Days Expired: ${Math.abs(daysUntilExpiry)} days ago`);
        } else {
          console.log(`Days Until Expiry: ${daysUntilExpiry} days`);
        }
      }
      
      console.log(`Max Displays: ${profile.maxDisplays}`);
      console.log(`Max Users: ${profile.maxUsers}`);
      console.log(`Max Storage: ${profile.maxStorageMB} MB`);
      console.log('-'.repeat(100));
    }

    console.log(`\nTotal Clients: ${profiles.length}\n`);

  } catch (error) {
    console.error('❌ Error listing licenses:', error);
  }
}

/**
 * Extend a license by days
 */
async function extendLicense(clientId, days) {
  try {
    const profile = await prisma.clientProfile.findUnique({
      where: { clientId },
      include: {
        clientAdmin: {
          select: { email: true },
        },
      },
    });

    if (!profile) {
      console.error(`❌ Client not found: ${clientId}`);
      return;
    }

    const currentExpiry = profile.licenseExpiry || new Date();
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + days);

    await prisma.clientProfile.update({
      where: { clientId },
      data: {
        licenseExpiry: newExpiry,
        isActive: true, // Reactivate if suspended
      },
    });

    console.log(`✅ License extended for ${profile.clientAdmin.email}`);
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Previous Expiry: ${profile.licenseExpiry ? profile.licenseExpiry.toISOString() : 'None'}`);
    console.log(`   New Expiry: ${newExpiry.toISOString()}`);
    console.log(`   Extended by: ${days} days`);

  } catch (error) {
    console.error('❌ Error extending license:', error);
  }
}

/**
 * Set a specific expiry date for a license
 */
async function setLicenseExpiry(clientId, expiryDate) {
  try {
    const profile = await prisma.clientProfile.findUnique({
      where: { clientId },
      include: {
        clientAdmin: {
          select: { email: true },
        },
      },
    });

    if (!profile) {
      console.error(`❌ Client not found: ${clientId}`);
      return;
    }

    const newExpiry = new Date(expiryDate);

    await prisma.clientProfile.update({
      where: { clientId },
      data: {
        licenseExpiry: newExpiry,
        isActive: true, // Reactivate if suspended
      },
    });

    console.log(`✅ License expiry set for ${profile.clientAdmin.email}`);
    console.log(`   Client ID: ${clientId}`);
    console.log(`   New Expiry: ${newExpiry.toISOString()}`);

  } catch (error) {
    console.error('❌ Error setting license expiry:', error);
  }
}

/**
 * Manually suspend a license
 */
async function suspendLicense(clientId) {
  try {
    const profile = await prisma.clientProfile.findUnique({
      where: { clientId },
      include: {
        clientAdmin: {
          select: { email: true },
        },
      },
    });

    if (!profile) {
      console.error(`❌ Client not found: ${clientId}`);
      return;
    }

    await prisma.clientProfile.update({
      where: { clientId },
      data: { isActive: false },
    });

    console.log(`🔒 License suspended for ${profile.clientAdmin.email}`);
    console.log(`   Client ID: ${clientId}`);

  } catch (error) {
    console.error('❌ Error suspending license:', error);
  }
}

/**
 * Manually activate a license
 */
async function activateLicense(clientId) {
  try {
    const profile = await prisma.clientProfile.findUnique({
      where: { clientId },
      include: {
        clientAdmin: {
          select: { email: true },
        },
      },
    });

    if (!profile) {
      console.error(`❌ Client not found: ${clientId}`);
      return;
    }

    await prisma.clientProfile.update({
      where: { clientId },
      data: { isActive: true },
    });

    console.log(`✅ License activated for ${profile.clientAdmin.email}`);
    console.log(`   Client ID: ${clientId}`);

  } catch (error) {
    console.error('❌ Error activating license:', error);
  }
}

// Command line interface
const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

(async () => {
  try {
    switch (command) {
      case 'list':
        await listLicenses();
        break;

      case 'extend':
        if (!arg1 || !arg2) {
          console.error('Usage: node manageLicenses.js extend <clientId> <days>');
          process.exit(1);
        }
        await extendLicense(arg1, parseInt(arg2));
        break;

      case 'set-expiry':
        if (!arg1 || !arg2) {
          console.error('Usage: node manageLicenses.js set-expiry <clientId> <YYYY-MM-DD>');
          process.exit(1);
        }
        await setLicenseExpiry(arg1, arg2);
        break;

      case 'suspend':
        if (!arg1) {
          console.error('Usage: node manageLicenses.js suspend <clientId>');
          process.exit(1);
        }
        await suspendLicense(arg1);
        break;

      case 'activate':
        if (!arg1) {
          console.error('Usage: node manageLicenses.js activate <clientId>');
          process.exit(1);
        }
        await activateLicense(arg1);
        break;

      default:
        console.log('License Management Tool\n');
        console.log('Usage:');
        console.log('  node manageLicenses.js list                              - List all licenses');
        console.log('  node manageLicenses.js extend <clientId> <days>          - Extend license by days');
        console.log('  node manageLicenses.js set-expiry <clientId> <YYYY-MM-DD> - Set specific expiry date');
        console.log('  node manageLicenses.js suspend <clientId>                - Suspend a license');
        console.log('  node manageLicenses.js activate <clientId>               - Activate a license');
        console.log('\nExamples:');
        console.log('  node manageLicenses.js list');
        console.log('  node manageLicenses.js extend CL-IXP9R0 30');
        console.log('  node manageLicenses.js set-expiry CL-IXP9R0 2026-12-31');
        console.log('  node manageLicenses.js suspend CL-IXP9R0');
        console.log('  node manageLicenses.js activate CL-IXP9R0');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
