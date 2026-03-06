const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
    const existing = await prisma.clientProfile.findFirst({
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

async function addClientIdsToExistingProfiles() {
  try {
    console.log('🔄 Adding Client IDs to existing client profiles...');

    // Find all client profiles (since clientId field might not exist yet)
    const allProfiles = await prisma.clientProfile.findMany({
      include: {
        clientAdmin: true
      }
    });

    console.log(`📊 Found ${allProfiles.length} client profiles`);

    if (allProfiles.length === 0) {
      console.log('✅ No client profiles found');
      return;
    }

    // Update each profile with a unique client ID
    for (const profile of allProfiles) {
      // Check if profile already has a clientId (in case field exists)
      if (profile.clientId) {
        console.log(`⏭️  Skipping ${profile.companyName || profile.clientAdmin.email} - already has Client ID: ${profile.clientId}`);
        continue;
      }

      const clientId = await generateClientId();
      
      await prisma.clientProfile.update({
        where: { id: profile.id },
        data: { clientId }
      });

      console.log(`✅ Updated ${profile.companyName || profile.clientAdmin.email} with Client ID: ${clientId}`);
    }

    console.log(`🎉 Successfully processed ${allProfiles.length} client profiles`);

  } catch (error) {
    console.error('❌ Error adding Client IDs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
if (require.main === module) {
  addClientIdsToExistingProfiles()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addClientIdsToExistingProfiles };