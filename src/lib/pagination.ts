export interface CursorPaginationParams {
  cursor?: string | null;
  limit?: number;
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Builds Prisma cursor arguments for high-performance cursor-based pagination.
 *
 * Rather than scanning past thousands or millions of rows with `skip`,
 * cursor pagination utilizes existing B-Tree primary key indexes to jump
 * directly to the target record in O(log N) time.
 */
export function buildPrismaCursorArgs(params?: CursorPaginationParams) {
  const limit = Math.min(Math.max(params?.limit || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const cursor = params?.cursor;

  return {
    take: limit + 1, // Fetch 1 extra item to check if next page exists
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    limit,
  };
}

/**
 * Processes the raw database query output into a standard cursor pagination envelope.
 */
export function formatCursorPaginationResult<T extends { id: string }>(
  rawItems: T[],
  limit: number
): CursorPaginationResult<T> {
  const hasMore = rawItems.length > limit;
  const items = hasMore ? rawItems.slice(0, limit) : rawItems;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return {
    items,
    nextCursor,
    hasMore,
    limit,
  };
}

/**
 * Executes a cursor-paginated Prisma query seamlessly.
 *
 * @param queryFn A function accepting Prisma arguments `{ take: number, cursor?: { id: string }, skip?: number }`
 * @param params `{ cursor?: string, limit?: number }`
 */
export async function executeCursorPagination<T extends { id: string }>(
  queryFn: (args: { take: number; cursor?: { id: string }; skip?: number }) => Promise<T[]>,
  params?: CursorPaginationParams
): Promise<CursorPaginationResult<T>> {
  const { take, cursor, skip, limit } = buildPrismaCursorArgs(params);

  const rawItems = await queryFn({
    take,
    ...(cursor ? { cursor, skip } : {}),
  });

  return formatCursorPaginationResult(rawItems, limit);
}
