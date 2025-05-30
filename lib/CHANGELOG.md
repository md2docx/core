# @m2d/core

## 1.1.0

### Minor Changes

- 56a8c29: Restructure utils and enhance caching system:
  - Move utils.ts to utils/index.ts for better organization
  - Replace cache-utils.ts with improved utils/cache.ts implementation
  - Add namespace support to cache entries for better management
  - Implement stale cache cleanup functionality
  - Enhance serialization with better handling of arrays and primitives
  - Update package.json exports to reflect new file structure
- 839e2e7: feat: add persistent caching utilities with IndexedDB support

  Implement a centralized caching mechanism that:

  - Provides both in-memory and persistent IndexedDB caching
  - Includes deterministic cache key generation with xxhash
  - Supports automatic timestamp tracking for cache entries
  - Prevents duplicate parallel processing with runtime cache
  - Adds xxhash-wasm dependency for efficient hashing

  This utility will improve performance by avoiding redundant
  expensive operations across the application.

## 1.0.2

### Patch Changes

- af4168a: fix image data types

## 1.0.1

### Patch Changes

- 6f7d1cb: Fix: fix type utils and update Plugin types to include definitions for preprocess.

## 1.0.1

### Patch Changes

- b0098bd: Update preprocess in plugin to include the definitions - required for rendering images.

## 1.0.0

### Major Changes

- a6643fe: Optimize plugin system by focusing promises only where needed. The `preprocess` method in the `IPlugin` interface now returns `void | Promise<void>` to allow plugins to perform asynchronous operations during the preprocessing phase, while removing promises from block and inline processors to improve performance. This change enables more flexible plugin implementations that can handle async tasks like fetching remote resources during preprocessing, while ensuring efficient synchronous rendering during the document generation phase. This change was announced here - https://github.com/md2docx/mdast2docx/discussions/15

### Minor Changes

- 194f266: Add Required types util

## 0.0.5

### Patch Changes

- aca557c: Update extended mdast types

## 0.0.4

### Patch Changes

- 075bdac: Update types to include svg
