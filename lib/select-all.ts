// Fetch every row of a Supabase query, defeating the server-side row cap.
//
// PostgREST (and Supabase) cap a single response at `db-max-rows` — 1000 on this
// project — regardless of any `.limit()` in code. Once the leads book passed
// 1000 rows, an unbounded (or even .limit(20000)) select silently returned only
// the first 1000, hiding every newer lead (num 1001+, i.e. every externally
// captured Instagram/WhatsApp lead) from the list, the search and the counts.
//
// Paging in chunks that are each <= the cap sidesteps it: request rows
// [0..999], then [1000..1999], and so on until a short page signals the end.

const CHUNK = 1000;

type QueryError = { message?: string } | null;
type PageResult<T> = { data: T[] | null; error: QueryError };

/**
 * `makeQuery(from, to)` must return a *fresh* Supabase range query each call,
 * e.g. `(f, t) => supabase.from("leads").select("...").order("num").range(f, t)`.
 * Returns the same `{ data, error }` shape as a normal query so callers can
 * destructure it unchanged.
 */
export async function selectAll<T>(
  makeQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ data: T[]; error: QueryError }> {
  const out: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await makeQuery(from, from + CHUNK - 1);
    if (error) return { data: out, error };
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < CHUNK) break;   // a short page is the last page
  }
  return { data: out, error: null };
}
