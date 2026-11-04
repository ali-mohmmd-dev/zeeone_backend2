export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  pages: number;
}

type PaginationInput =
  | {
      page?: number | string | null;
      limit?: number | string | null;
      defaultLimit?: number;
    }
  | number
  | string
  | null
  | undefined;

/**
 * Normalizes page and limit parameters safely.
 * Default page: 1
 * Default limit: 20
 * Maximum limit: 100
 */
export function normalizePagination(
  rawPageOrObj?: PaginationInput,
  rawLimit?: number | string | null,
  defaultLimit: number = 20
): NormalizedPagination {
  let rawPage: number | string | null | undefined;
  let limitVal: number | string | null | undefined = rawLimit;
  let defLimit = defaultLimit;

  if (rawPageOrObj && typeof rawPageOrObj === 'object') {
    rawPage = rawPageOrObj.page;
    limitVal = rawPageOrObj.limit;
    if (rawPageOrObj.defaultLimit) defLimit = rawPageOrObj.defaultLimit;
  } else {
    rawPage = rawPageOrObj;
  }

  const parsedPage = Number(rawPage);
  const parsedLimit = Number(limitVal);

  const page = !isNaN(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;

  let limit = !isNaN(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : defLimit;
  if (limit > 100) limit = 100;
  if (limit < 1) limit = defLimit;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Validates a client-provided sort field against an allowlist.
 * Prevents SQL/Prisma injection and invalid field exceptions.
 */
export function validateSortField<T extends string>(
  field: string | undefined | null,
  allowlist: readonly T[],
  defaultField: T
): T {
  if (!field) return defaultField;
  const match = allowlist.find((allowed) => allowed.toLowerCase() === field.toLowerCase());
  return match || defaultField;
}

/**
 * Validates and normalizes sort order ('asc' | 'desc').
 */
export function validateSortOrder(
  order: string | undefined | null,
  defaultOrder: 'asc' | 'desc' = 'desc'
): 'asc' | 'desc' {
  if (!order) return defaultOrder;
  const normalized = order.toLowerCase();
  if (normalized === 'asc' || normalized === 'desc') {
    return normalized;
  }
  return defaultOrder;
}

/**
 * Helper to build standard pagination response metadata
 */
export function buildPaginationResult(
  total: number,
  page: number,
  limit: number
): PaginationResult {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    totalPages,
    pages: totalPages,
  };
}
