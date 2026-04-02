# Phase 04: Caching Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 04-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 04-caching-layer
**Areas discussed:** Cache Scope, Concurrency, Error Handling, Data Structure, Cache Location, Expiration Strategy, Refresh Strategy, Cache Key, Debug Output

---

## Cache Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Single-provider cache | Cache file stores only current provider's data. Simple structure, overwrite on provider switch. | ✓ |
| Multi-provider cache | Cache file stores all providers' data with provider name as key. Complex structure, preserves history. | |

**User's choice:** Single-provider cache (推荐)
**Notes:** 简单直接。一次只监控一个提供商,缓存文件只存储当前提供商的数据。文件结构更简单,代码更清晰。

---

## Concurrency Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic write (write-then-rename) | Cross-platform compatible, no file locks needed. Write to temp file then atomic rename. | ✓ |
| File lock (flock/fcntl) | Use OS-level file locking. Stricter concurrency control, but may have issues on Windows and some filesystems. | |

**User's choice:** Atomic write (推荐)
**Notes:** 跨平台兼容,无需文件锁。写入临时文件然后原子性重命名,防止数据损坏。符合 REQUIREMENTS.md CACHE-04。

---

## Cache Degradation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore cache, call API | Cache read failure falls back to API call. User immediately sees new data. | ✓ |
| Throw error, require fix | Cache failure throws error, forcing user to fix cache issue. May impact statusLine availability. | |

**User's choice:** Ignore cache, call API (推荐)
**Notes:** 快速失败,清晰反馈。缓存读取失败时直接调用 API,用户立即看到新数据。符合项目的 fail-fast 原则。

---

## Cache Data Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Flat structure | Simple flat structure. Cache file directly stores usage data and timestamp. Small file size, fast read/write. | ✓ |
| Metadata wrapper | Extensible structure. Includes metadata (cached_at, provider, ttl) and data (actual usage data). Easier debugging, slightly larger file. | |

**User's choice:** Flat structure (推荐)
**Notes:** 简单扁平结构。缓存文件直接存储使用数据和时间戳。文件体积小,读写快速。适合单提供商场景。

---

## Cache Location

| Option | Description | Selected |
|--------|-------------|----------|
| System temp directory | Use `os.tmpdir()`. macOS: `/var/folders/...`, Linux: `/tmp`, Windows: `%TEMP%`. OS auto-cleanup, no Home pollution. | ✓ |
| User cache directory | Follow OS conventions. macOS: `~/Library/Caches/cc-usage/`, Linux: `~/.cache/cc-usage/`. Follows standards, but needs directory creation. | |
| Current directory `.cache/` | Local to current directory. Completely local, no global pollution. But cache not shared across different directories. | |

**User's choice:** System temp directory (推荐)
**Notes:** 用户反馈:"固定路径,你为什么写到CC Switch目录中了?这是我们支持的供应商,我们自己本身和CC Switch没什么关系。你能不能直接使用Npx或者Bunx运行时加载我们的包所在的默认的目录,不要污染用户的Home。"

系统临时目录不会污染用户 Home,操作系统自动清理,工具独立于 CC Switch。

---

## TTL Expiration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Strict expiration | Cache is expired when current time > cached_at + cache_duration. User always gets fresh data within TTL window. | ✓ |
| Lenient expiration | Allow slightly expired cache. If expired < 5 seconds, still return cache to avoid frequent API calls. | |

**User's choice:** Strict expiration (推荐)
**Notes:** 严格 TTL。当前时间超过 cached_at + cache_duration 时,缓存被认为过期,必须刷新。用户总是得到最新数据。

---

## Cache Refresh Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking refresh | When cache expires, wait for API response before returning new data. User always sees latest data, statusLine may have slight delay (< 2s). | ✓ |
| Background refresh | Return expired data immediately, trigger API refresh in background. User may see stale data, but fastest response. More complex implementation. | |

**User's choice:** Blocking refresh (推荐)
**Notes:** 简单阻塞。缓存过期时,等待 API 响应后返回新数据。用户总是得到最新数据,statusLine 可能稍有延迟(但 < 2秒)。

---

## Cache Key

| Option | Description | Selected |
|--------|-------------|----------|
| Provider name only | Simple and direct. When user switches providers, old cache is overwritten. Matches "single-provider cache" decision. | ✓ |
| Provider + API key hash | Support multiple accounts per provider. Cache filename includes hash of API key, different accounts have different caches. More complex, longer filenames. | |

**User's choice:** Provider name only (推荐)
**Notes:** 简单直接。当用户切换提供商时,旧缓存被覆盖。符合"单提供商缓存"决策,代码最简单。

---

## Debug Output

| Option | Description | Selected |
|--------|-------------|----------|
| No debug output | Silent mode. Cache hit/miss reflected through exit code or output timing. Simpler code. | ✓ |
| stderr debug logs | Developer-friendly. Output cache status to stderr for debugging. Phase 5 can control via --verbose flag. | |

**User's choice:** No debug output (推荐)
**Notes:** 静默模式。缓存命中/未命中通过退出码或输出来反映。符合简单原则,代码更清晰。

---

## Claude's Discretion

Areas where user said "you decide" or deferred to Claude:
- Exact error messages for cache write failures (logged to stderr)
- Whether to include process.pid in temp filename or use random UUID
- Unit test coverage boundaries (mock file system vs real temp files)
- Whether to create temp directory if it doesn't exist (defensive coding)

---

## Deferred Ideas

None — discussion stayed within phase scope. All caching layer concerns addressed.

---

*Discussion completed: 2026-04-02*
