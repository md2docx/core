# @m2d/core

## 1.7.1

### Patch Changes

- b186089: Fix potential crash when footnote definition is undefined

## 1.7.0

### Minor Changes

- 9302c0f: Add footnoteProps to ISectionProps for custom footnote styling

  Added `footnoteProps` property to `ISectionProps` interface that allows configuring paragraph and run styling options specifically for footnote content rendering. This enables fine-grained control over footnote appearance in generated DOCX documents.

### Patch Changes

- 5340741: Fix stableSerialize to properly pass ignoreKeys parameter to getSerializableKeys function. Possibly leading to minor performance enhancement

## 1.6.0

### Minor Changes

- c250ec4: Add blockquote styling with left indent and border.
  - Indent: left `720`, hanging `360`
  - Border: inset left border (`size: 20`, `space: 14`, `color: aaaaaa`)
  - Produces visually distinct blockquotes with proper formatting

### Patch Changes

- ab89cfb: Fixes issue parsing markdown with multiple footnotes

## 1.5.0

### Minor Changes

- fc9452c: feat: add trimInnerSpaces option to section processing for whitespace normalization

## 1.4.3

### Patch Changes

- 26199b2: Attempt to keep entire code block on same page.
- 4fbac23: feat/utils: add mergeOptions function for deep merging user and default options

## 1.4.2

### Patch Changes

- 45be2da: Expand data type to handle more of HTML Input element data.

## 1.4.1

### Patch Changes

- 502fd3e: Better type safety and minor rename cacheTarget to cacheMode

## 1.4.0

### Minor Changes

- 0a4b4b6: Refactored `createPersistentCache` to accept a `config` object for optional settings.

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
    parallel, // compute + read race (default: true)
  });
  ```

  - **In-memory cache sharing**: Pass a shared cache object to coordinate between modules or tabs.
  - **Configurable cache strategies**:
    - `cacheTarget`: choose where data is stored — RAM, IndexedDB, or both.
    - `parallel`: race compute and read to optimize latency.

  This is a **breaking change** for plugins that use caching due to the updated function signature.
  No changes for other users.

## 1.3.4

### Patch Changes

- 7bd97ca: fix: Bring back the Extended Node support and default to EmptyNode

## 1.3.3

### Patch Changes

- f091bdd: Simplify types.

## 1.3.2

### Patch Changes

- 56f6b67: fix: Update types for supporting HTML and advanced tables

## 1.3.1

### Patch Changes

- 2b67af0: fix tag types in node data

## 1.3.0

### Minor Changes

- 8d34bf3: Update types to ensure sufficient data for converting to jsx
- 8f9703a: refactor plugin interface to update postprocess hook. Since there is very limited scope for utilizing the document object once creted, we are moving the postprocess hook to be called just before creating the document object. It gets list of sections which can be finished up just before converting to docx.

## 1.2.0

### Minor Changes

- 8857587: Export docx object for advanced users
- bc0e116: Add postprocess hook to the plugins

## 1.1.6

### Patch Changes

- 96d0580: Use Promise.any to load the results as fast as possible either from cache or from directly generating using the generator function

## 1.1.5

### Patch Changes

- 500717b: fix: recursive serialization for objects

## 1.1.4

### Patch Changes

- 3731ab8: fix: handle case when generator return undefined or null

## 1.1.3

### Patch Changes

- 84d9dbd: fix SVG node value types

## 1.1.2

### Patch Changes

- 7dd01ca: Remove non-serializable fields from the generator result before caching

## 1.1.1

### Patch Changes

- f9dc971: fix: ignore promises in stableSerialize

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
