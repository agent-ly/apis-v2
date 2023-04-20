/**
 * @template TData
 * @param {import('./pagination.js').GetPageFn<TData>} getPage
 * @returns {import('./pagination.js').AsyncIterablePageCursor<TData>}
 * */
export const createPageCursor = (getPage) => ({
  async *[Symbol.asyncIterator]() {
    /** @type {string | null} */
    let cursor;
    while (cursor !== null) {
      const { data, nextPageCursor } = await getPage(cursor);
      cursor = nextPageCursor;
      yield data;
    }
  },
  async toArray() {
    /** @type {TData[]} */
    let results = [];
    for await (const data of this) {
      results = results.concat(data);
    }
    return results;
  },
});
