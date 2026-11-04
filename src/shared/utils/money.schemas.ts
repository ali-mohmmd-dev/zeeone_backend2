import { z } from 'zod';
import { decimal } from './money.js';

const decimalInputSchema = z.union([
  z.number().finite(),
  z.string().trim().regex(/^-?\d+(\.\d+)?$/, 'Enter a valid decimal amount'),
]).transform(decimal);

export const moneySchema = decimalInputSchema.refine(
  (value) => value.decimalPlaces() <= 4 && value.abs().lessThan('1000000000000000'),
  'Amount must fit 15 integer digits and at most 4 decimal places',
);

export const taxRateSchema = decimalInputSchema.refine(
  (value) => value.decimalPlaces() <= 6 && value.abs().lessThan(1000),
  'Tax rate must fit 3 integer digits and at most 6 decimal places',
);
