import { Prisma } from '@prisma/client';

export function decimal(value: Prisma.Decimal.Value | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(value ?? 0);
}

export function roundMoney(value: Prisma.Decimal.Value): Prisma.Decimal {
  return decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function moneyMax(first: Prisma.Decimal.Value, second: Prisma.Decimal.Value): Prisma.Decimal {
  return Prisma.Decimal.max(first, second);
}
