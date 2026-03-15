import { vi } from "vitest";

export interface MockSupabaseChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  then: undefined;
}

export function createMockSupabaseClient() {
  const defaultResult = { data: null, error: null };

  const chain: MockSupabaseChain = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    contains: vi.fn(),
    range: vi.fn(),
    then: undefined,
  };

  // Make every method return the chain itself (for chaining)
  for (const key of Object.keys(chain) as (keyof MockSupabaseChain)[]) {
    if (key === "then") continue;
    (chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  }

  // By default, awaiting the chain resolves to { data: null, error: null }
  // This is achieved by making the chain thenable
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: (val: unknown) => void) => resolve(defaultResult);
    },
    configurable: true,
    enumerable: false,
  });

  const from = vi.fn().mockReturnValue(chain);
  const rpc = vi.fn().mockResolvedValue(defaultResult);

  const client = {
    from,
    rpc,
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  };

  return { client, chain, from, rpc };
}

/**
 * Configure chain to resolve with specific data when awaited.
 */
export function mockResolve(chain: MockSupabaseChain, data: unknown) {
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: (val: unknown) => void) => resolve({ data, error: null });
    },
    configurable: true,
    enumerable: false,
  });
  return chain;
}

/**
 * Configure chain to resolve with an error when awaited.
 */
export function mockReject(chain: MockSupabaseChain, error: { message: string; code?: string }) {
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: (val: unknown) => void) => resolve({ data: null, error });
    },
    configurable: true,
    enumerable: false,
  });
  return chain;
}

/**
 * Set up from() to return different chains for different tables.
 * Usage: mockFromTable(from, { agents: agentChain, tasks: taskChain })
 */
export function createTableMocks(
  from: ReturnType<typeof vi.fn>,
  tables: Record<string, MockSupabaseChain>
) {
  from.mockImplementation((table: string) => {
    if (tables[table]) return tables[table];
    // Default: return a fresh chain
    const { chain } = createMockSupabaseClient();
    return chain;
  });
}
