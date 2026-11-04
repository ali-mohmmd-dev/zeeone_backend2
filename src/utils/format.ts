import { decimal } from '../shared/utils/money.js';
import type { Prisma } from '@prisma/client';

export function formatCurrency(
  amount: Prisma.Decimal.Value,
  currency: string = 'INR',
  locale: string = 'en-IN'
): string {
  // Intl accepts decimal strings without converting amounts to binary floats.
  const formatAmount = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format as (value: string | number) => string;
  return formatAmount(decimal(amount).toFixed(2));
}
