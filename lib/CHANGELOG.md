# @m2d/core

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
