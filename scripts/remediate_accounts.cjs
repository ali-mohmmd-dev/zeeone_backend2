const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function remediateExistingAccounts() {
  console.log('--- Checking Accounts for Password Remediation ---');
  const users = await prisma.user.findMany();

  for (const user of users) {
    if (user.role === 'admin' || user.email === 'admin@elevate.com') {
      console.log(`[PRESERVED] Admin user ${user.email} preserved untouched.`);
      continue;
    }

    if (!user.password) {
      console.log(`[SKIP] User ${user.email} has no password.`);
      continue;
    }

    const isBcrypt = user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$');
    if (isBcrypt) {
      console.log(`[OK] User ${user.email} already has a valid bcrypt hash.`);
      continue;
    }

    console.log(`[FIXING] User ${user.email} has plaintext password. Hashing securely with bcrypt...`);
    const plaintext = user.password;
    const hashedPassword = await bcrypt.hash(plaintext, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    // Also ensure credential account record exists for Better-Auth / provider parity
    await prisma.account.upsert({
      where: { id: `acc_${user.id}` },
      create: {
        id: `acc_${user.id}`,
        userId: user.id,
        accountId: user.email.toLowerCase().trim(),
        providerId: 'credential',
        password: hashedPassword,
        updatedAt: new Date(),
      },
      update: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    console.log(`[SUCCESS] User ${user.email} password hashed and account record synced.`);
  }

  // Also ensure credential account record for Admin if not present, WITHOUT modifying admin password hash
  const admin = await prisma.user.findUnique({ where: { email: 'admin@elevate.com' } });
  if (admin && admin.password) {
    await prisma.account.upsert({
      where: { id: `acc_${admin.id}` },
      create: {
        id: `acc_${admin.id}`,
        userId: admin.id,
        accountId: admin.email.toLowerCase().trim(),
        providerId: 'credential',
        password: admin.password,
        updatedAt: new Date(),
      },
      update: {
        updatedAt: new Date(),
      },
    });
    console.log(`[SYNCED] Admin credential account record ensured.`);
  }

  console.log('--- Remediation Complete ---');
}

remediateExistingAccounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
