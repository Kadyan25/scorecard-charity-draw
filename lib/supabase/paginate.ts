import "server-only";

const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Read every row of a query, page by page.
 *
 * PostgREST caps a response at 1,000 rows by default and says nothing when it
 * truncates. For the draw that would silently drop members once a few hundred
 * people had five scores each, so any "all rows" read goes through here.
 * `page(from, to)` must apply a stable order so pages do not overlap.
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load ${label}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

/** Insert in batches so a large draw does not exceed request size limits. */
export async function insertInChunks<T>(
  rows: readonly T[],
  insert: (chunk: T[]) => PromiseLike<{ error: { message: string } | null }>,
  label: string,
  chunkSize = 500,
): Promise<void> {
  for (let start = 0; start < rows.length; start += chunkSize) {
    const { error } = await insert(rows.slice(start, start + chunkSize));
    if (error) throw new Error(`Could not save ${label}: ${error.message}`);
  }
}
