import { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../utils/response.js';
import { loginSchema, registerSchema } from './auth.schema.js';
import { AuthService } from './auth.service.js';

export class AuthController {
  static async login(request: FastifyRequest, reply: FastifyReply) {
    const startTime = performance.now();

    const validated = loginSchema.parse(request.body);
    const authService = new AuthService(request.server.prisma);
    const user = await authService.login(validated);

    const token = await reply.jwtSign({
      authVersion: user.authVersion,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branch: user.branch,
      permissions: user.permissions,
    });

    reply.setCookie('token', token, {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    reply.setCookie('user', encodeURIComponent(JSON.stringify(user)), {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    reply.setCookie('auth_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    const elapsed = performance.now() - startTime;
    request.log.info(`Login completed in ${elapsed.toFixed(2)}ms`);

    return reply.send(successResponse({ user, token }, 'Logged in successfully'));
  }

  static async register(request: FastifyRequest, reply: FastifyReply) {
    const validated = registerSchema.parse(request.body);
    const authService = new AuthService(request.server.prisma);
    const newUser = await authService.register(validated);

    return reply.status(201).send(successResponse(newUser, 'User registered successfully'));
  }

  static async logout(_request: FastifyRequest, reply: FastifyReply) {
    reply.clearCookie('auth_token', { path: '/' });
    return reply.send(successResponse(null, 'Logged out successfully'));
  }

  static async getMe(request: FastifyRequest, reply: FastifyReply) {
    const authService = new AuthService(request.server.prisma);
    const user = await authService.getMe(request.user.id);
    return reply.send(successResponse(user));
  }
}
