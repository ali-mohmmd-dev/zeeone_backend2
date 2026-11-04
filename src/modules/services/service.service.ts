import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../errors/app-error.js';
import { ServiceItemInput } from './service.schema.js';

export class ServicesService {
  constructor(private prisma: PrismaClient) {}

  async listServices(activeOnly: boolean = false) {
    return this.prisma.service.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' },
    });
  }

  async createService(input: ServiceItemInput) {
    return this.prisma.service.create({ data: input });
  }

  async updateService(id: string, input: Partial<ServiceItemInput>) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundError('Service');
    return this.prisma.service.update({ where: { id }, data: input });
  }

  async deleteService(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundError('Service');
    return this.prisma.service.delete({ where: { id } });
  }
}
