import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../errors/app-error.js';
import { BranchInput, CourseInput } from './master-data.schema.js';

export const STATIC_ROLES = [
  { id: 'admin', name: 'admin', description: 'Administrator with full access' },
  { id: 'executive', name: 'executive', description: 'Executive with management access' },
  { id: 'telecaller', name: 'telecaller', description: 'Telecaller with calling & basic CRM access' },
];

export const STATIC_ENQUIRY_SOURCES = [
  { id: 'website', name: 'Website' },
  { id: 'walk-in', name: 'Walk-in' },
  { id: 'referral', name: 'Referral' },
  { id: 'social-media', name: 'Social Media' },
  { id: 'campaign', name: 'Campaign' },
  { id: 'other', name: 'Other' },
];

export class MasterDataService {
  constructor(private prisma: PrismaClient) {}

  // --- Branches ---
  async listBranches(activeOnly: boolean = false) {
    return this.prisma.branch.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' },
    });
  }

  async createBranch(input: BranchInput) {
    return this.prisma.branch.create({ data: input });
  }

  async updateBranch(id: string, input: Partial<BranchInput>) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundError('Branch');
    return this.prisma.branch.update({ where: { id }, data: input });
  }

  async deleteBranch(id: string) {
    return this.prisma.branch.delete({ where: { id } });
  }

  // --- Courses ---
  async listCourses(activeOnly: boolean = false) {
    return this.prisma.course.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' },
    });
  }

  async createCourse(input: CourseInput) {
    return this.prisma.course.create({ data: input });
  }

  async updateCourse(id: string, input: Partial<CourseInput>) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundError('Course');
    return this.prisma.course.update({ where: { id }, data: input });
  }

  async deleteCourse(id: string) {
    return this.prisma.course.delete({ where: { id } });
  }

  // --- Enquiry Sources (Static / In-memory for cost effectiveness) ---
  async listEnquirySources(_activeOnly: boolean = false) {
    return STATIC_ENQUIRY_SOURCES;
  }

  // --- Required Services (Maps to Service model) ---
  async listRequiredServices(activeOnly: boolean = false) {
    return this.prisma.service.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' },
    });
  }

  // --- Roles ---
  async listRoles() {
    return STATIC_ROLES;
  }
}
