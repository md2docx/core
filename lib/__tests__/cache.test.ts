import { beforeEach, describe, it, vi } from "vitest";
import {
  createPersistentCache,
  generateCacheKey,
  stableSerialize,
} from "../src/utils/cache";

// Mock xxhash-wasm
vi.mock("xxhash-wasm", () => ({
  default: vi.fn(() =>
    Promise.resolve({
      h64ToString: vi.fn((input: string) => {
        return `hash-${Buffer.from(input).toString("base64").slice(0, 8)}`;
      }),
    }),
  ),
}));

describe.concurrent("stableSerialize", () => {
  it("should serialize primitives", ({ expect }) => {
    expect(stableSerialize("test", [])).toBe("test");
    expect(stableSerialize(123, [])).toBe("123");
    expect(stableSerialize(true, [])).toBe("true");
    expect(stableSerialize(null, [])).toBe("null");
  });

  it("should serialize arrays in sorted order", ({ expect }) => {
    expect(stableSerialize([3, 1, 2], [])).toBe("1,2,3");
    expect(stableSerialize(["c", "a", "b"], [])).toBe("a,b,c");
  });

  it("should serialize objects with sorted keys", ({ expect }) => {
    const obj = { b: 2, a: 1, c: 3 };
    expect(stableSerialize(obj, [])).toBe("a:1|b:2|c:3");
  });

  it("should ignore specified keys", ({ expect }) => {
    const obj = { a: 1, b: 2, ignore: 3 };
    const result = stableSerialize(obj, ["ignore"]);
    expect(result).toBe("a:1|b:2");
  });

  it("should skip functions and undefined values", ({ expect }) => {
    const obj = { a: 1, fn: () => {}, undef: undefined, b: 2 };
    expect(stableSerialize(obj, [])).toBe("a:1|b:2");
  });

  it("should handle nested objects", ({ expect }) => {
    const obj = { a: { c: 3, b: 2 }, d: 1 };
    expect(stableSerialize(obj, [])).toBe("a:b:2|c:3|d:1");
  });
});

describe.concurrent("generateCacheKey", () => {
  it("should generate consistent hash for same inputs", async ({ expect }) => {
    const key1 = await generateCacheKey([], "test", 123);
    const key2 = await generateCacheKey([], "test", 123);
    expect(key1).toBe(key2);
  });

  it("should generate different hashes for different inputs", async ({
    expect,
  }) => {
    const key1 = await generateCacheKey([], "test1");
    const key2 = await generateCacheKey([], "test2");
    expect(key1).not.toBe(key2);
  });

  it("should respect ignoreKeys parameter", async ({ expect }) => {
    const obj1 = { a: 1, ignore: "x" };
    const obj2 = { a: 1, ignore: "y" };
    const key1 = await generateCacheKey(["ignore"], obj1);
    const key2 = await generateCacheKey(["ignore"], obj2);
    expect(key1).toBe(key2);
  });
});

describe.concurrent("createPersistentCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should cache function results in memory mode", async ({ expect }) => {
    let callCount = 0;
    const mockFn = vi.fn(() => {
      callCount++;
      return Promise.resolve(`result-${callCount}`);
    });

    const cache = {};
    const cachedFn = createPersistentCache(mockFn, "test", {
      cacheMode: "memory",
      cache,
    });

    const result1 = await cachedFn();
    const result2 = await cachedFn();

    expect(result1).toBe("result-1");
    expect(result2).toBe("result-1"); // Same result from cache
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("Caching is mapped to arguments not the return value", async ({
    expect,
  }) => {
    let callCount = 0;
    const mockFn = vi.fn(() => {
      callCount++;
      return Promise.resolve(`result-${callCount}`);
    });

    const cache = {};
    const cachedFn = createPersistentCache(mockFn, "test", {
      cacheMode: "memory",
      cache,
    });

    const result1 = await cachedFn();
    const result2 = await cachedFn();
    const result3 = await cachedFn();

    expect(result1).toBe("result-1");
    expect(result2).toBe("result-1");
    expect(result3).toBe("result-1"); // From cache
  });

  it("should use external cache object when provided", async ({ expect }) => {
    const externalCache: Record<string, Promise<string>> = {};
    const mockFn = vi.fn().mockResolvedValue("result");
    const cachedFn = createPersistentCache(mockFn, "test", {
      cacheMode: "memory",
      cache: externalCache,
    });

    await cachedFn("arg1");
    expect(Object.keys(externalCache)).toHaveLength(1);
  });

  it("should respect ignoreKeys in cache configuration", async ({ expect }) => {
    const mockFn = vi.fn(
      ({ data, timestamp }: { data: string; timestamp: number }) => {
        return Promise.resolve(`result-${data}-${timestamp}`);
      },
    );

    const cache = {};
    const cachedFn = createPersistentCache(mockFn, "test", {
      cacheMode: "memory",
      cache,
      ignoreKeys: ["timestamp"],
    });

    const result1 = await cachedFn({ data: "test", timestamp: 1 });
    const result2 = await cachedFn({ data: "test", timestamp: 2 });

    expect(result1).toBe("result-test-1");
    expect(result2).toBe("result-test-1"); // Same result from cache
  });

  it("should handle async function errors", async ({ expect }) => {
    const mockFn = vi.fn().mockRejectedValue(new Error("test error"));
    const cache = {};
    const cachedFn = createPersistentCache(mockFn, "test", {
      cacheMode: "memory",
      cache,
    });

    await expect(cachedFn("arg1")).rejects.toThrow("test error");
  });

  it("should work with complex object arguments", async ({ expect }) => {
    let callCount = 0;
    const mockFn = vi.fn((_args: unknown) => {
      callCount++;
      return Promise.resolve(`result-${callCount}`);
    });

    const cache = {};
    const cachedFn = createPersistentCache(mockFn, "test", {
      cacheMode: "memory",
      cache,
    });

    const complexArg = {
      nested: { array: [1, 2, 3], value: "test" },
      simple: 42,
    };

    const result1 = await cachedFn(complexArg);
    const result2 = await cachedFn(complexArg);

    expect(result1).toBe("result-1");
    expect(result2).toBe("result-1"); // From cache
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
