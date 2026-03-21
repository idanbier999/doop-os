/**
 * Mock infrastructure for Drizzle ORM database client.
 *
 * Creates a mock `getDb()` that returns a mock DB with `.select()`, `.insert()`,
 * `.update()`, `.delete()`, and `.execute()` methods. Each returns a chainable
 * mock that resolves when awaited.
 *
 * Usage:
 *   const { mockDb, pushResult, pushError, reset } = createMockDb();
 *   vi.mock("@/lib/db/client", () => ({ getDb: () => mockDb }));
 *
 *   pushResult([{ id: "1", name: "agent" }]); // first db operation returns this
 *   pushResult([]);                            // second db operation returns this
 *   pushError(new Error("fail"));              // third db operation throws
 */
import { vi } from "vitest";

/**
 * Creates a chainable mock that resolves to `data` when awaited.
 * Every method on the chain (select, from, where, etc.) returns `this`.
 */
export function createChainMock(data: unknown = []) {
  const chain: Record<string, unknown> = {};

  const methods = [
    "select",
    "from",
    "where",
    "limit",
    "orderBy",
    "returning",
    "set",
    "values",
    "innerJoin",
    "leftJoin",
    "rightJoin",
    "fullJoin",
    "on",
    "groupBy",
    "having",
    "offset",
  ];

  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }

  // Store resolve/reject values
  let _resolveData: unknown = data;
  let _rejectError: unknown = null;

  // Make the chain thenable (awaitable)
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) => {
        if (_rejectError) {
          if (reject) return reject(_rejectError);
          throw _rejectError;
        }
        return resolve(_resolveData);
      };
    },
    configurable: true,
    enumerable: false,
  });

  // Allow external mutation of resolve data (for test setup)
  chain._setResolve = (val: unknown) => {
    _resolveData = val;
  };
  chain._setReject = (err: unknown) => {
    _rejectError = err;
  };

  return chain;
}

export function createMockDb() {
  const resultQueue: Array<{ data?: unknown; error?: unknown }> = [];
  let queueIndex = 0;

  function nextChain() {
    const entry = resultQueue[queueIndex++];
    if (!entry) {
      // Default: return empty array
      return createChainMock([]);
    }
    if (entry.error) {
      const chain = createChainMock();
      (chain as Record<string, unknown>)._setReject(entry.error);
      return chain;
    }
    return createChainMock(entry.data);
  }

  const mockDb = {
    select: vi.fn(() => nextChain()),
    insert: vi.fn(() => nextChain()),
    update: vi.fn(() => nextChain()),
    delete: vi.fn(() => nextChain()),
    execute: vi.fn(() => {
      const entry = resultQueue[queueIndex++];
      if (!entry) return Promise.resolve([]);
      if (entry.error) return Promise.reject(entry.error);
      return Promise.resolve(entry.data);
    }),
  };

  return {
    mockDb,
    /** Queue a result for the next DB operation */
    pushResult: (data: unknown) => {
      resultQueue.push({ data });
    },
    /** Queue an error for the next DB operation */
    pushError: (error: unknown) => {
      resultQueue.push({ error });
    },
    /** Reset the queue and index */
    reset: () => {
      resultQueue.length = 0;
      queueIndex = 0;
    },
  };
}
