import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { AppError, ForbiddenError } from '../../errors/app-error.js';

export function requireSecret(actual: string | undefined, expected: string): void {
  if (!expected) throw new AppError('Meta integration is not configured', 503, 'META_NOT_CONFIGURED');
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!actual || !timingSafeEqual(digest(actual), digest(expected))) {
    throw new ForbiddenError('Invalid integration credentials');
  }
}

export function verifySignature(body: Buffer, signature: string | undefined, appSecret: string): void {
  if (!appSecret) throw new AppError('Meta integration is not configured', 503, 'META_NOT_CONFIGURED');
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) {
    throw new ForbiddenError('Invalid Meta webhook signature');
  }
  const expected = createHmac('sha256', appSecret).update(body).digest();
  const supplied = Buffer.from(signature.slice(7), 'hex');
  if (!timingSafeEqual(expected, supplied)) throw new ForbiddenError('Invalid Meta webhook signature');
}
