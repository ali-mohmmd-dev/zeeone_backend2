import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true } });
    const branches = await prisma.branch.findMany();
    const roles = await prisma.role.findMany();
    const courses = await prisma.course.findMany();
    const services = await prisma.service.findMany();

    console.log('=== DATABASE STATUS ===');
    console.log('Users count:', users.length, users);
    console.log('Branches count:', branches.length, branches);
    console.log('Roles count:', roles.length, roles);
    console.log('Courses count:', courses.length, courses);
    console.log('Services count:', services.length, services);
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
