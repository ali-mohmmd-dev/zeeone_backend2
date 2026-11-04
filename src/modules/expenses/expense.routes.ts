import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { ExpenseController } from './expense.controller.js';

export const expenseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', ExpenseController.listExpenses);
  fastify.get('/summary', ExpenseController.getSummary);
  fastify.get('/:id', ExpenseController.getExpense);
  fastify.post('/', { preHandler: [requireRole(['admin', 'executive'])] }, ExpenseController.createExpense);
  fastify.patch('/:id', { preHandler: [requireRole(['admin', 'executive'])] }, ExpenseController.updateExpense);
  fastify.delete('/:id', { preHandler: [requireRole(['admin'])] }, ExpenseController.deleteExpense);
};
