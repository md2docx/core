import xxhash from "xxhash-wasm";

/**
 * Centralized, reusable persistent caching mechanism using IndexedDB.
 *
 * - Avoids creating multiple IndexedDB databases or object stores
 * - Maximizes storage capacity by consolidating data
 * - Ensures plugin interoperability and storage efficiency
 * - Supports both in-memory and persistent caching
 */

/** Name of the IndexedDB database for plugin-wide caching */
const CACHE_DB_NAME = "m2d-cache";

/** Version of the IndexedDB schema */
const CACHE_DB_VERSION = 1;

/** Object store name within IndexedDB for caching expensive computations */
const CACHE_STORE_NAME = "m2d";

/** Special field used to store last modification/access time in minutes */
export const LAST_ACCESSED_FIELD = "last-accessed";

/** In-memory runtime cache to avoid duplicate parallel processing */
const runtimeCache: Record<string, Promise<unknown>> = {};

/* v8 ignore start - IndexedDB is not available in test environments */
/**
 * Opens the IndexedDB database, creating it and its object store if needed.
 * This function returns a shared promise to prevent redundant DB openings.
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
 * Retrieves a cached value from IndexedDB by key.
 *
 * @param key - The cache key to look up
 * @returns A promise resolving to the cached value, or `undefined` if not found
 */
export const readFromCache = <T>(key: string): Promise<T | undefined> =>
  openCacheDatabase()
    .then(db => {
      return new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE_NAME, "readonly");
        const store = tx.objectStore(CACHE_STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          // Optionally re-save to bump last accessed timestamp
          if (result) writeToCache(result.id, result);
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
 * Stores a value in IndexedDB under the specified cache key.
 *
 * @param id - The unique key used to identify the cached value
 * @param value - The data to store in cache
 */
export const writeToCache = <T>(id: string, value: T): Promise<void> =>
  openCacheDatabase()
    .then(db => {
      const tx = db.transaction(CACHE_STORE_NAME, "readwrite");
      const store = tx.objectStore(CACHE_STORE_NAME);
      store.put({ id, ...value, [LAST_ACCESSED_FIELD]: Date.now() / 60000 });

      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = err => reject(err);
      });
    })
    .catch(err => {
      console.warn("[cache]", err);
    });
/* v8 ignore end */

/**
 * Deterministic object serializer for cache key generation.
 *
 * - Removes volatile or non-essential properties (e.g. `imageResolver`)
 * - Ensures consistent key structure for identical inputs
 */
const stableSerialize = (obj: Record<string, unknown>, ignoreKeys: string[]): string => {
  const copy = { ...obj };
  ignoreKeys.forEach(key => delete copy[key]);
  return Object.keys(copy)
    .sort()
    .map(key => `${key}:${copy[key]}`)
    .join("|");
};

/**
 * Generates a unique and stable cache key based on provided input data.
 *
 * @param fingerprint - A base string to seed the hash (e.g., image src)
 * @param options - Additional options that influence output
 * @returns A consistent 64-bit hash string representing the input combination
 */
export const generateCacheKey = async (
  fingerprint: string,
  options: Record<string, unknown>,
  ignoreKeys: string[],
): Promise<string> => {
  const { h64ToString } = await xxhash();
  return h64ToString(fingerprint + stableSerialize(options, ignoreKeys));
};

/**
 * Wraps an async generator function with in-memory and persistent caching logic.
 *
 * - Ensures no duplicated computation for the same inputs
 * - Automatically caches results in both memory and IndexedDB
 *
 * @param generator - The expensive function to cache (e.g., image renderer)
 * @param generateCacheKey - Function to produce a unique key from generator args
 * @returns A wrapped version of `generator` with caching enabled
 */
export const createPersistentCache = <Args extends unknown[], Result>(
  generator: (...args: Args) => Promise<Result>,
  generateCacheKey: (...args: Args) => Promise<string>,
): ((...args: Args) => Promise<Result>) => {
  return async (...args: Args): Promise<Result> => {
    const cacheKey = await generateCacheKey(...args);

    runtimeCache[cacheKey] ??= (async () => {
      const cachedResult = await readFromCache<Result>(cacheKey);
      if (cachedResult) return cachedResult;

      const result = await generator(...args);
      writeToCache(cacheKey, result);
      return result;
    })();

    return runtimeCache[cacheKey] as Promise<Result>;
  };
};