import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up operational data...');

  // Clear all operational data
  await prisma.notification.deleteMany({});
  await prisma.jobLead.deleteMany({});
  await prisma.jobOrder.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.receipt.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.admission.deleteMany({});
  await prisma.followUp.deleteMany({});
  await prisma.callLog.deleteMany({});
  await prisma.enquiry.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});

  console.log('Operational data cleared.');
  console.log('Seeding master data...');

  // 1. Seed Roles
  const roles = [
    { name: 'admin', description: 'Administrator with full access', permissions: ['*'] },
    { name: 'executive', description: 'Executive with management access', permissions: ['manage:all'] },
    { name: 'telecaller', description: 'Telecaller with calling & basic CRM access', permissions: ['read:leads', 'create:leads', 'update:leads'] },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description, permissions: r.permissions },
      create: r,
    });
  }
  console.log('Roles ensured.');

  // 2. Seed Enquiry Sources
  const enquirySources = ['Website', 'Walk-in', 'Referral', 'Social Media', 'Campaign', 'Other'];
  for (const src of enquirySources) {
    await prisma.enquirySource.upsert({
      where: { name: src },
      update: {},
      create: { name: src },
    });
  }
  console.log('Enquiry sources ensured.');

  // 3. Create default branch
  const mainBranch = await prisma.branch.upsert({
    where: { name: 'Main Branch' },
    update: {},
    create: {
      name: 'Main Branch',
      address: 'Default Branch Address',
      phone: '+91 0000000000',
      email: 'admin@elevate.com',
    },
  });
  console.log('Branches ensured.');

  // 4. Ensure Admin User
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  const adminEmail = 'admin@elevate.com';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
      role: 'admin',
      roleId: adminRole?.id,
    },
    create: {
      name: 'Admin User',
      email: adminEmail,
      password: hashedPassword,
      emailVerified: true,
      role: 'admin',
      roleId: adminRole?.id,
    },
  });

  console.log(`Admin user ensured: ${adminEmail}`);
  console.log('Clean seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
