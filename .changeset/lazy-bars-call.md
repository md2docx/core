---
"@m2d/core": minor
---

Refactored `createPersistentCache` to accept a `config` object for optional settings.

**Before:**

```ts
createPersistentCache(generator, namespace, ignoreKeys?, useIdb?)
```

**Now:**

```ts
createPersistentCache(generator, namespace, {
  ignoreKeys,
  cache, // optional in-memory cache object for cross-plugin sharing
  cacheTarget, // "memory" | "idb" | "both" (default: "both")
  resolveInParallel, // compute + read race (default: true)
});
```

- **In-memory cache sharing**: Pass a shared cache object to coordinate between modules or tabs.
- **Configurable cache strategies**:

  - `cacheTarget`: choose where data is stored — RAM, IndexedDB, or both.
  - `resolveInParallel`: race compute and read to optimize latency.

This is a **breaking change** due to the updated function signature.

```

```
