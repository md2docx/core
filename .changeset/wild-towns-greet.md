---
"@m2d/core": minor
---

feat: add persistent caching utilities with IndexedDB support

Implement a centralized caching mechanism that:

- Provides both in-memory and persistent IndexedDB caching
- Includes deterministic cache key generation with xxhash
- Supports automatic timestamp tracking for cache entries
- Prevents duplicate parallel processing with runtime cache
- Adds xxhash-wasm dependency for efficient hashing

This utility will improve performance by avoiding redundant
expensive operations across the application.
