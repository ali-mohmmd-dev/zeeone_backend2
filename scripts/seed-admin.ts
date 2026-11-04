import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: 'admin@elevate.com' },
  });

  if (existing) {
    console.log('Admin user already exists:', existing);
    return;
  }

  const admin = await prisma.user.create({
    data: {
      id: 'cmulac21o000bse1ckve8jth7',
      name: 'Admin User',
      email: 'admin@elevate.com',
      emailVerified: true,
      role: 'admin',
      password: '$2b$10$OJtm7mHMtKh0OlN/ClVfQ.L4rAXs/QNu03vJA5.9QLwALtmKGK6Ee',
    },
  });

  console.log('Created admin user in new DB:', admin);
}

main()
  .catch((e) => {
    console.error('Error seeding admin:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
