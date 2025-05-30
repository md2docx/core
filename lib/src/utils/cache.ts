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
const runtimeCache: Record<string, Promise<unknown>> = {};

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
const readFromCache = <T>(key: string): Promise<T | undefined> =>
  openCacheDatabase()
    .then(db => {
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
    .catch(err => {
      console.warn("[cache]", err);
      return undefined;
    });

/**
 * Writes a value to IndexedDB under the given cache key.
 *
 * @param value - Object to store; must include `id` and `namespace`
 */
const writeToCache = <T extends { namespace: string; id: string }>(value: T): Promise<void> =>
  openCacheDatabase()
    .then(db => {
      const tx = db.transaction(CACHE_STORE_NAME, "readwrite");
      const store = tx.objectStore(CACHE_STORE_NAME);
      store.put({ ...value, [LAST_ACCESSED_FIELD]: Date.now() / 60000 });

      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = err => reject(err);
      });
    })
    .catch(err => {
      console.warn("[cache]", err);
    });
/* v8 ignore end */

/** get list of serializable keys in sorted order */
const getSerializableKeys = (object: Record<string, unknown>, ignoreKeys: string[] = []) =>
  Object.keys(object).filter(key => {
    const value = object[key];
    return (
      !ignoreKeys.includes(key) &&
      value !== undefined &&
      typeof value !== "function" &&
      typeof (value as any)?.then !== "function"
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
const stableSerialize = (obj: unknown, ignoreKeys: string[]): string => {
  if (Array.isArray(obj)) {
    return obj
      .map(item => stableSerialize(item, ignoreKeys))
      .sort()
      .join(",");
  }

  if (typeof obj !== "object" || obj === null) {
    return String(obj);
  }

  const copy: Record<string, unknown> = { ...obj };

  return getSerializableKeys(copy)
    .sort()
    .map(key => `${key}:${copy[key]}`)
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
  const serialized = args.map(arg => stableSerialize(arg, ignoreKeys)).join(",");
  return h64ToString(serialized);
};

/**
 * Creates a wrapper around a generator function that adds in-memory and persistent caching.
 *
 * - Prevents redundant computation by caching results in IndexedDB and memory
 * - Automatically tracks access time for future cleanup
 *
 * @param generator - Function to cache
 * @param namespace - A string to tag the data for cleanup/filtering purposes
 * @param ignoreKeys - Optional list of keys to ignore during serialization
 * @returns A wrapped version of the generator with caching behavior
 */
export const createPersistentCache = <Args extends unknown[], Result>(
  generator: (...args: Args) => Promise<Result>,
  namespace: string,
  ignoreKeys: string[] = [],
  useIdb = true,
): ((...args: Args) => Promise<Result>) => {
  return async (...args: Args): Promise<Result> => {
    const cacheKey = await generateCacheKey(ignoreKeys, ...args);

    runtimeCache[cacheKey] ??= (async () => {
      if (useIdb) {
        const cachedResult = await readFromCache<Result>(cacheKey);
        if (cachedResult) return cachedResult;
      }

      const result = (await generator(...args)) as Record<string, string> | undefined;
      const resultsToCache = { id: cacheKey, namespace } as {
        id: string;
        namespace: string;
        [key: string]: unknown;
      };
      if (result)
        getSerializableKeys(result).forEach(key => {
          resultsToCache[key] = result[key];
        });
      else resultsToCache.namespace = "keep";
      writeToCache(resultsToCache);
      return result;
    })();

    return runtimeCache[cacheKey] as Promise<Result>;
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
export const simpleCleanup = async (maxAgeMinutes: number, namespace: string): Promise<void> => {
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
