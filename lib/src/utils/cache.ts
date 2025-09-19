import xxhash from "xxhash-wasm";

/**
 * Centralized, persistent caching utility using IndexedDB and in-memory runtime cache.
 *
 * - Consolidates all cached data into a single IndexedDB database and store
 * - Prevents redundant computations by reusing results across sessions
 * - Enables plugin interoperability and optimizes resource usage
 */

/** IndexedDB database name used for plugin-wide persistent cache */
const CACHE_DB_NAME = "m2d-cache";

/** Schema version for IndexedDB */
const CACHE_DB_VERSION = 1;

/** Object store name used for storing expensive computation results */
const CACHE_STORE_NAME = "m2d";

/** Field name for tracking last access time (in minutes since epoch) */
const LAST_ACCESSED_FIELD = "last-accessed";

/** In-memory cache to deduplicate ongoing parallel requests */
const defaultCache: Record<string, Promise<unknown>> = {};

/* v8 ignore start - IndexedDB is not available in test environments */
/**
 * Opens (and creates if needed) the IndexedDB database and object store.
 * This function reuses a single promise to avoid redundant open operations.
 */
const openCacheDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/**
 * Reads a cached value from IndexedDB by key.
 *
 * @param key - Unique cache key
 * @returns The cached value, or `undefined` if not found
 */
export const readFromCache = <T>(key: string): Promise<T | undefined> =>
  openCacheDatabase()
    .then((db) => {
      return new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE_NAME, "readonly");
        const store = tx.objectStore(CACHE_STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          // Optionally update last accessed timestamp
          if (result) writeToCache(result);
          resolve(result);
        };

        request.onerror = () => reject(request.error);
      });
    })
    .catch((err) => {
      console.warn("[cache]", err);
      return undefined;
    });

/**
 * Writes a value to IndexedDB under the given cache key.
 *
 * @param value - Object to store; must include `id` and `namespace`
 */
export const writeToCache = <T extends { namespace: string; id: string }>(
  value: T,
): Promise<void> =>
  openCacheDatabase()
    .then((db) => {
      const tx = db.transaction(CACHE_STORE_NAME, "readwrite");
      const store = tx.objectStore(CACHE_STORE_NAME);
      store.put({ ...value, [LAST_ACCESSED_FIELD]: Date.now() / 60000 });

      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = (err) => reject(err);
      });
    })
    .catch((err) => {
      console.warn("[cache]", err);
    });
/* v8 ignore end */

/** get list of serializable keys in sorted order */
const getSerializableKeys = (
  object: Record<string, unknown>,
  ignoreKeys: string[] = [],
) =>
  Object.keys(object).filter((key) => {
    const value = object[key];
    return (
      !ignoreKeys.includes(key) &&
      value !== undefined &&
      typeof value !== "function" &&
      typeof (value as PromiseLike<unknown>)?.then !== "function"
    );
  });

/**
 * Serializes a value into a stable string for cache key generation.
 *
 * - Recursively handles arrays and objects
 * - Skips functions, promises and undefined values
 * - Omits keys listed in `ignoreKeys` (only for objects)
 * - Ensures consistent key ordering for objects
 *
 * @param obj - The input to serialize (can be primitive, array, or object)
 * @param ignoreKeys - Keys to exclude from object serialization
 * @returns A stable, stringified representation
 */
export const stableSerialize = (obj: unknown, ignoreKeys: string[]): string => {
  if (Array.isArray(obj)) {
    return obj
      .map((item) => stableSerialize(item, ignoreKeys))
      .sort()
      .join(",");
  }

  if (typeof obj !== "object" || obj === null) {
    return String(obj);
  }

  const copy: Record<string, unknown> = { ...obj };

  return getSerializableKeys(copy, ignoreKeys)
    .sort()
    .map((key) => `${key}:${stableSerialize(copy[key], ignoreKeys)}`)
    .join("|");
};

/**
 * Generates a consistent 64-bit hash key for caching based on input arguments.
 *
 * - Serializes objects using `stableSerialize`
 * - Combines all arguments into a single stable string
 *
 * @param ignoreKeys - Keys to exclude from object serialization
 * @param args - Values to base the cache key on (objects, arrays, or primitives)
 * @returns A stable 64-bit hash string
 */
export const generateCacheKey = async (
  ignoreKeys: string[],
  ...args: unknown[]
): Promise<string> => {
  const { h64ToString } = await xxhash();
  const serialized = args
    .map((arg) => stableSerialize(arg, ignoreKeys))
    .join(",");
  return h64ToString(serialized);
};

/**
 * Configuration options for the persistent caching utility.
 *
 * @template TResult - Result type returned by the generator function.
 */
interface BaseCacheConfig<TResult> {
  /**
   * Keys to exclude when generating a stable cache key from input arguments.
   */
  ignoreKeys?: string[];

  /**
   * In-memory cache object, useful for cache sharing across plugins/tabs.
   */
  cache?: Record<string, Promise<TResult>>;
}

interface MemoryOnlyCacheConfig<TResult> extends BaseCacheConfig<TResult> {
  /**
   * Store only in RAM (fast, temporary). No IndexedDB fallback.
   */
  cacheMode: "memory";

  /**
   * No parallel computation needed since memory cache is synchronous.
   */
  parallel?: never;
}

interface IdbOrBothCacheConfig<TResult> extends BaseCacheConfig<TResult> {
  /**
   * Store in IndexedDB, or both memory and IndexedDB.
   */
  cacheMode: "idb" | "both";

  /**
   * If true, read from cache and compute in parallel.
   * Defaults to true.
   */
  parallel?: boolean;
}

/**
 * Type-safe configuration for createPersistentCache utility.
 */
export type CacheConfigType<TResult> =
  | MemoryOnlyCacheConfig<TResult>
  | IdbOrBothCacheConfig<TResult>;

/**
 * Creates a cached version of an async function with memory and/or persistent caching capabilities.
 *
 * ## Features:
 * - Prevents redundant computations across sessions or concurrent calls
 * - Shares results between tabs or plugins (Pass external cache object to share in-memory cache across plugins)
 * - Supports in-memory, IndexedDB, or both as cache targets
 * - Optional parallel execution of cache read and function compute
 * - Useful for data generation, API fetches, or any expensive computation
 * *
 * ## Parameters
 * @template Args - Argument types of the generator function
 * @template Result - Return type of the generator function
 *
 * @param generator - The async function to cache (e.g., a fetcher or processor)
 * @param namespace - A tag used to group related cached entries for cleanup or metrics
 * @param config - Optional configuration:
 *   - `ignoreKeys` _(string[])_ — Keys to exclude from cache key generation (default: `[]`)
 *   - `cache` _(Record<string, Promise<Result>>)_ — External in-memory cache object to sync across plugins/tabs (default: internal default cache)
 *   - `cacheTarget` _(`"memory"` | `"idb"` | `"both"`)_ — Where to store the result:
 *       - `"memory"`: RAM-only; fast but temporary
 *       - `"idb"`: stores in IndexedDB only; avoids memory usage; Useful for processing large data
 *       - `"both"` (default): caches in both RAM and IndexedDB
 *   - `parallel` _(boolean)_ — If true, reads from cache and computes in parallel (default: `true`);
 *       ignored when `cacheTarget` is `"memory"`
 *
 * @returns A memoized async function that handles caching automatically.
 *
 * @example
 * const fetchWithCache = createPersistentCache(fetchJson, "remote-data");
 * await fetchWithCache("https://example.com/api/data");
 */
export const createPersistentCache = <TArgs extends unknown[], TResult>(
  generator: (...args: TArgs) => Promise<TResult>,
  namespace: string,
  config?: CacheConfigType<TResult>,
): ((...args: TArgs) => Promise<TResult>) => {
  const {
    ignoreKeys = [],
    cache = defaultCache as Record<string, Promise<TResult>>,
    cacheMode = "both",
    parallel = true,
  } = config ?? {};

  return async (...args: TArgs): Promise<TResult> => {
    const cacheKey = await generateCacheKey(ignoreKeys, ...args);

    if (cacheMode === "memory") {
      cache[cacheKey] ??= generator(...args);
      return cache[cacheKey];
    }

    const resultPromise = (async () => {
      const result = parallel
        ? await Promise.any([
            readFromCache<TResult>(cacheKey).then(
              (result) => result ?? Promise.reject(),
            ),
            generator(...args),
          ])
        : ((await readFromCache<TResult>(cacheKey)) ??
          (await generator(...args)));

      const resultsToCache = { id: cacheKey, namespace } as {
        id: string;
        namespace: string;
        [key: string]: unknown;
      };
      if (result)
        getSerializableKeys(result).forEach((key) => {
          resultsToCache[key] = (result as Record<string, unknown>)[key];
        });
      writeToCache(resultsToCache);
      return result;
    })();

    if (cacheMode === "both") cache[cacheKey] = resultPromise;

    return resultPromise;
  };
};

/**
 * Deletes stale cache entries from IndexedDB based on age and namespace.
 *
 * - Only entries with matching `namespace` are considered
 * - Entries older than `maxAgeMinutes` (based on `last-accessed` field) are deleted
 *
 * Requirements for each entry:
 * - `namespace: string` set in `createPersistentCache`
 * - `last-accessed: number` is automatically set by `writeToCache`
 *
 * @param maxAgeMinutes - Age threshold in minutes; entries older than this will be removed
 * @param namespace - Namespace tag to limit cleanup scope
 */
export const simpleCleanup = async (
  maxAgeMinutes: number,
  namespace: string,
): Promise<void> => {
  try {
    const db = await openCacheDatabase();
    const tx = db.transaction(CACHE_STORE_NAME, "readwrite");
    const store = tx.objectStore(CACHE_STORE_NAME);
    const now = Date.now() / 60000; // current time in minutes

    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;

      const value = cursor.value;
      const lastAccessed = value[LAST_ACCESSED_FIELD] ?? 0;

      if (value.namespace === namespace && now - lastAccessed > maxAgeMinutes) {
        cursor.delete();
      }

      cursor.continue();
    };
  } catch (err) {
    console.warn("[cache cleanup]", err);
  }
};
