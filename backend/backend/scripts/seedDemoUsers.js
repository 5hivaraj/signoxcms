const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function upsertUser({ email, password, role, staffRole, managedByClientAdminId, createdByUserAdminId }) {
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return prisma.user.update({
      where: { email },
      data: {
        password: passwordHash,
        role,
        staffRole: staffRole ?? null,
        isActive: true,
        managedByClientAdminId: managedByClientAdminId ?? null,
        createdByUserAdminId: createdByUserAdminId ?? null,
      },
    });
  }

  return prisma.user.create({
    data: {
      email,
      password: passwordHash,
      role,
      staffRole: staffRole ?? null,
      isActive: true,
      managedByClientAdminId: managedByClientAdminId ?? null,
      createdByUserAdminId: createdByUserAdminId ?? null,
    },
  });
}

async function main() {
  // 1) SUPER_ADMIN (already seeded by seedAdmin.js, but we keep it consistent)
  const superAdmin = await upsertUser({
    email: 'admin@signox.com',
    password: 'admin123',
    role: 'SUPER_ADMIN',
  });

  // 2) CLIENT_ADMIN + profile
  const clientAdmin = await upsertUser({
    email: 'client@signox.com',
    password: 'client123',
    role: 'CLIENT_ADMIN',
  });

  await prisma.clientProfile.upsert({
    where: { clientAdminId: clientAdmin.id },
    update: {
      clientId: 'CL-DEMO-001',
      maxDisplays: 5,
      maxUsers: 10,
      licenseExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // +30 days
      companyName: 'Demo Client Co',
      contactEmail: 'client@signox.com',
      isActive: true,
    },
    create: {
      clientAdminId: clientAdmin.id,
      clientId: 'CL-DEMO-001',
      maxDisplays: 5,
      maxUsers: 10,
      licenseExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      companyName: 'Demo Client Co',
      contactEmail: 'client@signox.com',
      isActive: true,
    },
  });

  // 3) USER_ADMIN under that client
  const userAdmin = await upsertUser({
    email: 'useradmin@signox.com',
    password: 'useradmin123',
    role: 'USER_ADMIN',
    managedByClientAdminId: clientAdmin.id,
  });

  // 4) STAFF users created by that user admin
  const contentManager = await upsertUser({
    email: 'content@signox.com',
    password: 'content123',
    role: 'STAFF',
    staffRole: 'CONTENT_MANAGER',
    createdByUserAdminId: userAdmin.id,
  });

  const broadcastManager = await upsertUser({
    email: 'broadcast@signox.com',
    password: 'broadcast123',
    role: 'STAFF',
    staffRole: 'BROADCAST_MANAGER',
    createdByUserAdminId: userAdmin.id,
  });

  const displayManager = await upsertUser({
    email: 'display@signox.com',
    password: 'display123',
    role: 'STAFF',
    staffRole: 'DISPLAY_MANAGER',
    createdByUserAdminId: userAdmin.id,
  });

  console.log('✅ Demo users ready:');
  console.log('- SUPER_ADMIN: admin@signox.com / admin123');
  console.log('- CLIENT_ADMIN: client@signox.com / client123');
  console.log('- USER_ADMIN: useradmin@signox.com / useradmin123');
  console.log('- STAFF CONTENT_MANAGER: content@signox.com / content123');
  console.log('- STAFF BROADCAST_MANAGER: broadcast@signox.com / broadcast123');
  console.log('- STAFF DISPLAY_MANAGER: display@signox.com / display123');

  // Prevent “unused” lint in some environments
  void superAdmin;
  void contentManager;
  void broadcastManager;
  void displayManager;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

