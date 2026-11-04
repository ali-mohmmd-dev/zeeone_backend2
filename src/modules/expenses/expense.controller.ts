import { FastifyReply, FastifyRequest } from 'fastify';
import { paginatedResponse, successResponse } from '../../utils/response.js';
import { createExpenseSchema, expenseFilterSchema, updateExpenseSchema } from './expense.schema.js';
import { ExpenseService } from './expense.service.js';

export class ExpenseController {
  static async listExpenses(request: FastifyRequest, reply: FastifyReply) {
    const filters = expenseFilterSchema.parse(request.query);
    const service = new ExpenseService(request.server.prisma);
    const { expenses, total } = await service.listExpenses(filters);
    return reply.send(paginatedResponse(expenses, total, filters.page, filters.limit));
  }

  static async getExpense(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new ExpenseService(request.server.prisma);
    const expense = await service.getExpenseById(id);
    return reply.send(successResponse(expense));
  }

  static async createExpense(request: FastifyRequest, reply: FastifyReply) {
    const validated = createExpenseSchema.parse(request.body);
    const service = new ExpenseService(request.server.prisma);
    const created = await service.createExpense(validated, request.user.id);
    return reply.status(201).send(successResponse(created, 'Expense logged successfully'));
  }

  static async updateExpense(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = updateExpenseSchema.parse(request.body);
    const service = new ExpenseService(request.server.prisma);
    const updated = await service.updateExpense(id, validated);
    return reply.send(successResponse(updated, 'Expense updated successfully'));
  }

  static async deleteExpense(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new ExpenseService(request.server.prisma);
    await service.deleteExpense(id);
    return reply.send(successResponse(null, 'Expense deleted successfully'));
  }

  static async getSummary(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = (request.query as { startDate?: string; endDate?: string }) || {};
    const service = new ExpenseService(request.server.prisma);
    const summary = await service.getSummary(startDate, endDate);
    return reply.send(successResponse(summary));
  }
}