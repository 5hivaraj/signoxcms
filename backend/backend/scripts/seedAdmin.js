const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  const email = 'admin@signox.com';
  
  // 1. Check if user exists first (This avoids the "Replica Set" requirement)
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  const passwordHash = await bcrypt.hash('admin123', 10);

  if (existingUser) {
    // Ensure this account is a SUPER_ADMIN for the new role system
    const updated = await prisma.user.update({
      where: { email },
      data: {
        password: passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    console.log('✅ Admin user updated to SUPER_ADMIN:', { id: updated.id, email: updated.email, role: updated.role });
    return;
  }

  // Use upsert instead of create to avoid transaction issues
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      email,
      password: passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('✅ SUPER_ADMIN created:', { id: admin.id, email: admin.email, role: admin.role });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });