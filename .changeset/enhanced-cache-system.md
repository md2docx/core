---
"@m2d/core": minor
---

Restructure utils and enhance caching system:
- Move utils.ts to utils/index.ts for better organization
- Replace cache-utils.ts with improved utils/cache.ts implementation
- Add namespace support to cache entries for better management
- Implement stale cache cleanup functionality
- Enhance serialization with better handling of arrays and primitives
- Update package.json exports to reflect new file structure