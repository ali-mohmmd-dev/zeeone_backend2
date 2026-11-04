import type { Prisma } from '@prisma/client';
// Expense Category enum (matching Prisma schema exactly)
export enum ExpenseCategory {
  OFFICE_SUPPLIES = 'OFFICE_SUPPLIES',
  TRAVEL = 'TRAVEL',
  UTILITIES = 'UTILITIES',
  MARKETING = 'MARKETING',
  MEALS = 'MEALS',
  EQUIPMENT = 'EQUIPMENT',
  SOFTWARE = 'SOFTWARE',
  OTHER = 'OTHER',
}

// Base interfaces
export interface Expense {
  id: string;
  title: string;
  description: string | null;
  amount: Prisma.Decimal.Value;
  category: ExpenseCategory;
  expenseDate: Date;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseItem {
  id: string;
  title: string;
  description: string | null;
  amount: Prisma.Decimal.Value;
  category: ExpenseCategory;
  expenseDate: Date;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

// Extended interfaces with relations
export interface ExpenseWithRelations extends Expense {
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

// Form data types
export interface CreateExpenseInput {
  title: string;
  description?: string | null;
  amount: Prisma.Decimal.Value;
  category: ExpenseCategory;
  expenseDate?: Date;
  notes?: string | null;
}

export interface UpdateExpenseInput {
  id: string;
  title?: string;
  description?: string | null;
  amount?: Prisma.Decimal.Value;
  category?: ExpenseCategory;
  expenseDate?: Date;
  notes?: string | null;
}

export interface ExpenseFormData {
  title: string;
  description?: string | null;
  amount: Prisma.Decimal.Value;
  category: ExpenseCategory;
  expenseDate: Date;
  notes?: string | null;
}

// Filter and pagination types
export interface ExpenseFilters {
  search?: string;
  category?: ExpenseCategory;
  dateFrom?: Date;
  dateTo?: Date;
  createdBy?: string;
}

export interface ExpensePagination {
  page: number;
  limit: number;
  total: number;
}

export interface ExpenseListResponse {
  expenses: ExpenseWithRelations[];
  pagination: ExpensePagination;
}

// Summary types for calculations
export interface ExpenseSummary {
  totalExpenses: Prisma.Decimal.Value;
  expensesByCategory: Record<ExpenseCategory, Prisma.Decimal.Value>;
  expensesByMonth: Record<string, Prisma.Decimal.Value>;
  totalCount: number;
}

// Table display types
export interface ExpenseTableRow {
  id: string;
  title: string;
  description: string | null;
  amount: Prisma.Decimal.Value;
  category: ExpenseCategory;
  expenseDate: Date;
  createdBy: {
    name: string;
    email: string;
  };
  createdAt: Date;
}

// Category display mapping
export const ExpenseCategoryLabels: Record<ExpenseCategory, string> = {
  [ExpenseCategory.OFFICE_SUPPLIES]: 'Office Supplies',
  [ExpenseCategory.TRAVEL]: 'Travel',
  [ExpenseCategory.UTILITIES]: 'Utilities',
  [ExpenseCategory.MARKETING]: 'Marketing',
  [ExpenseCategory.MEALS]: 'Meals',
  [ExpenseCategory.EQUIPMENT]: 'Equipment',
  [ExpenseCategory.SOFTWARE]: 'Software',
  [ExpenseCategory.OTHER]: 'Other',
};

// Category color mapping for badges
export const ExpenseCategoryColors: Record<ExpenseCategory, string> = {
  [ExpenseCategory.OFFICE_SUPPLIES]: 'bg-blue-100 text-blue-800',
  [ExpenseCategory.TRAVEL]: 'bg-green-100 text-green-800',
  [ExpenseCategory.UTILITIES]: 'bg-yellow-100 text-yellow-800',
  [ExpenseCategory.MARKETING]: 'bg-purple-100 text-purple-800',
  [ExpenseCategory.MEALS]: 'bg-orange-100 text-orange-800',
  [ExpenseCategory.EQUIPMENT]: 'bg-red-100 text-red-800',
  [ExpenseCategory.SOFTWARE]: 'bg-indigo-100 text-indigo-800',
  [ExpenseCategory.OTHER]: 'bg-gray-100 text-gray-800',
};