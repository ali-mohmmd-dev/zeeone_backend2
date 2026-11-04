import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { NotFoundError } from '../../errors/app-error.js';
import { UpdateUserInput, UserFilterInput } from './user.schema.js';

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async listUsers(filters: UserFilterInput) {
    const { search, role, branch, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (role) where.role = role;
    if (branch) where.branch = branch;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branch: true,
          image: true,
          banned: true,
          banReason: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branch: true,
        image: true,
        banned: true,
        banReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundError('User');
    return user;
  }

  async updateUser(id: string, input: UpdateUserInput) {
    await this.getUserById(id);

    return this.prisma.user.update({
      where: { id },
      data: input,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branch: true,
        banned: true,
        banReason: true,
        updatedAt: true,
      },
    });
  }

  async setPassword(userId: string, newPassword: string) {
    await this.getUserById(userId);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async deleteUser(id: string) {
    await this.getUserById(id);
    return this.prisma.user.delete({ where: { id } });
  }
}
