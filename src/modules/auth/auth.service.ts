import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ConflictError, UnauthorizedError } from '../../errors/app-error.js';
import { LoginInput, RegisterInput } from './auth.schema.js';
import { getUserEffectivePermissions } from '../workflows/support/lib/permissions.js';

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
      include: { userRole: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.banned) {
      throw new UnauthorizedError(`Account is banned: ${user.banReason || 'No reason specified'}`);
    }

    if (!user.password) {
      throw new UnauthorizedError('Invalid credentials or no password set for this account');
    }

    const isMatch = await bcrypt.compare(input.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const permissions = getUserEffectivePermissions(user);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branch: user.branch,
      permissions,
      userRole: (user as any).userRole ?? null,
    };
  }

  async register(input: RegisterInput) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase().trim(),
        password: hashedPassword,
        role: input.role,
        branch: input.branch,
        emailVerified: true,
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRole: true },
    });

    if (!user) {
      throw new UnauthorizedError('User session expired or user no longer exists');
    }

    const permissions = getUserEffectivePermissions(user);
    const { password: _password, ...publicUser } = user;
    return {
      ...publicUser,
      permissions,
    };
  }
}
