import { PrismaClient } from '@prisma/client';
import { config } from '../src/config/env.js';
const prisma = new PrismaClient({
  datasources: { db: { url: config.databaseUrl } },
});

async function seedMasterData(): Promise<void> {
  console.log('Seeding roles and branches...');

  const defaultRoles = [
    { id: 'role_admin', name: 'admin', description: 'Full administrative access', permissions: ['*'] },
    { id: 'role_manager', name: 'manager', description: 'Branch & Operations Manager', permissions: ['leads:manage', 'enquiries:manage', 'reports:view'] },
    { id: 'role_executive', name: 'executive', description: 'Branch Executive', permissions: ['admissions:create', 'invoices:create'] },
    { id: 'role_telecaller', name: 'telecaller', description: 'Telecaller for enquiries and follow-ups', permissions: ['enquiries:read', 'calls:create'] },
    { id: 'role_counselor', name: 'counselor', description: 'Academic Counselor', permissions: ['enquiries:manage', 'admissions:create'] },
  ];

  for (const role of defaultRoles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, permissions: role.permissions },
      create: {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        updatedAt: new Date(),
      },
    });
  }
  console.log('Roles seeded successfully.');

  const defaultBranches = [
    { id: 'branch_main', name: 'Main Branch', address: 'Head Office, Default Branch', phone: '+91 9876543210', email: 'main@elevate.com' },
    { id: 'branch_calicut', name: 'Calicut Branch', address: 'Mavoor Road, Calicut', phone: '+91 9876543211', email: 'calicut@elevate.com' },
    { id: 'branch_kochi', name: 'Kochi Branch', address: 'MG Road, Kochi', phone: '+91 9876543212', email: 'kochi@elevate.com' },
  ];

  for (const branch of defaultBranches) {
    await prisma.branch.upsert({
      where: { name: branch.name },
      update: { address: branch.address, phone: branch.phone, email: branch.email },
      create: {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        email: branch.email,
        isActive: true,
      },
    });
  }
  console.log('Branches seeded successfully.');
}

async function main(): Promise<void> {
  try {
    await seedMasterData();
  } catch (error: unknown) {
    console.error('Error seeding master data:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
