import { vi } from "vitest";

// Mock cookies store
const cookieStore = new Map<string, { name: string; value: string }>();

export const mockCookies = {
  get: vi.fn((name: string) => cookieStore.get(name) || undefined),
  set: vi.fn((name: string, value: string) => cookieStore.set(name, { name, value })),
  delete: vi.fn((name: string) => cookieStore.delete(name)),
  has: vi.fn((name: string) => cookieStore.has(name)),
  getAll: vi.fn(() => Array.from(cookieStore.values())),
  _store: cookieStore,
};

export const mockHeaders = new Map<string, string>();

export function setupNextMocks() {
  vi.mock("next/headers", () => ({
    cookies: vi.fn(() => mockCookies),
    headers: vi.fn(() => mockHeaders),
  }));

  vi.mock("next/navigation", () => ({
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
    })),
    usePathname: vi.fn(() => "/dashboard"),
    useSearchParams: vi.fn(() => new URLSearchParams()),
  }));

  vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
  }));
}

export function resetNextMocks() {
  cookieStore.clear();
  mockHeaders.clear();
  mockCookies.get.mockClear();
  mockCookies.set.mockClear();
  mockCookies.delete.mockClear();
}
