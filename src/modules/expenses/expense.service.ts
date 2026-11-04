import { decimal } from '../../shared/utils/money.js';
import { PrismaClient, Prisma, ExpenseCategory } from '@prisma/client';
import { NotFoundError } from '../../errors/app-error.js';
import { CreateExpenseInput, ExpenseFilterInput, UpdateExpenseInput } from './expense.schema.js';

export class ExpenseService {
  constructor(private prisma: PrismaClient) {}

  async listExpenses(filters: ExpenseFilterInput) {
    const { category, startDate, endDate, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {};
    if (category) where.category = category as ExpenseCategory;

    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) where.expenseDate.lte = new Date(endDate);
    }

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expenseDate: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { expenses, total };
  }

  async getExpenseById(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });

    if (!expense) throw new NotFoundError('Expense');
    return expense;
  }

  async createExpense(input: CreateExpenseInput, currentUserId: string) {
    return this.prisma.expense.create({
      data: {
        title: input.title,
        description: input.description,
        amount: input.amount,
        category: input.category as ExpenseCategory,
        expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
        notes: input.notes,
        createdById: currentUserId,
      },
    });
  }

  async updateExpense(id: string, input: UpdateExpenseInput) {
    await this.getExpenseById(id);

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...input,
        expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined,
      },
    });
  }

  async deleteExpense(id: string) {
    await this.getExpenseById(id);
    return this.prisma.expense.delete({ where: { id } });
  }

  async getSummary(startDate?: string, endDate?: string) {
    const where: Prisma.ExpenseWhereInput = {};
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) where.expenseDate.lte = new Date(endDate);
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      select: { amount: true, category: true },
    });

    const totalAmount = expenses.reduce((sum, e) => decimal(sum).plus(e.amount), decimal(0));
    const categoryBreakdown: Record<string, Prisma.Decimal> = {};

    for (const e of expenses) {
      categoryBreakdown[e.category] = decimal(categoryBreakdown[e.category] || 0).plus(e.amount);
    }

    return {
      totalAmount,
      totalCount: expenses.length,
      categoryBreakdown,
    };
  }
}
