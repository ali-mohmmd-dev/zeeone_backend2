import { FastifyReply, FastifyRequest } from 'fastify';
import { paginatedResponse, successResponse } from '../../utils/response.js';
import { changePasswordSchema, updateUserSchema, userFilterSchema } from './user.schema.js';
import { UserService } from './user.service.js';

export class UserController {
  static async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const filters = userFilterSchema.parse(request.query);
    const userService = new UserService(request.server.prisma);
    const { users, total } = await userService.listUsers(filters);

    return reply.send(paginatedResponse(users, total, filters.page, filters.limit));
  }

  static async getUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const userService = new UserService(request.server.prisma);
    const user = await userService.getUserById(id);
    return reply.send(successResponse(user));
  }

  static async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = updateUserSchema.parse(request.body);
    const userService = new UserService(request.server.prisma);
    const updated = await userService.updateUser(id, validated);
    return reply.send(successResponse(updated, 'User updated successfully'));
  }

  static async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = changePasswordSchema.parse(request.body);
    const userService = new UserService(request.server.prisma);
    await userService.setPassword(id, validated.password);
    return reply.send(successResponse(null, 'Password updated successfully'));
  }

  static async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const userService = new UserService(request.server.prisma);
    await userService.deleteUser(id);
    return reply.send(successResponse(null, 'User deleted successfully'));
  }
}