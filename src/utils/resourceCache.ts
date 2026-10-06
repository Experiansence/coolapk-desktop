const MEMORY_CACHE_LIMIT = 300;
// Data URL 字符串按 UTF-16 保守估算；条数限制无法约束几百张大图的占用。
const MEMORY_CACHE_BYTE_LIMIT = 24 * 1024 * 1024;
const MEMORY_CACHE_ENTRY_BYTE_LIMIT = 4 * 1024 * 1024;

type ResourceFetcher = (url: string) => Promise<string>;

const memoryCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string>>();
let memoryCacheBytes = 0;
let cacheGeneration = 0;

/**
 * 统一图片地址，避免同一资源因为协议写法不同产生多份缓存。
 */
export function normalizeResourceUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('http://')) return `https://${trimmed.slice('http://'.length)}`;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:') && !trimmed.startsWith('blob:') && !trimmed.startsWith('/')) {
    if (trimmed.includes('/') || trimmed.includes('.jpg') || trimmed.includes('.png') || trimmed.includes('.webp') || trimmed.includes('.gif')) {
      return `https://image.coolapk.com/${trimmed}`;
    }
  }
  return trimmed;
}

/**
 * 所有 HTTP/HTTPS 图片都允许进入原生文件缓存，包括需要登录态的私信图片。
 */
export function canPersistResource(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function remember(url: string, value: string) {
  const existing = memoryCache.get(url);
  if (existing !== undefined) {
    memoryCacheBytes -= (url.length + existing.length) * 2;
    memoryCache.delete(url);
  }
  const bytes = (url.length + value.length) * 2;
  // 大图由当前显示组件持有即可，避免在全局缓存中额外延长其生命周期。
  if (bytes > MEMORY_CACHE_ENTRY_BYTE_LIMIT) return;
  memoryCache.set(url, value);
  memoryCacheBytes += bytes;

  while (memoryCache.size > MEMORY_CACHE_LIMIT || memoryCacheBytes > MEMORY_CACHE_BYTE_LIMIT) {
    const oldestKey = memoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    memoryCacheBytes -= (oldestKey.length + memoryCache.get(oldestKey)!.length) * 2;
    memoryCache.delete(oldestKey);
  }
}

/**
 * 同步检查并获取内存图片缓存（0 延迟，避免重渲染时出现转菊花白屏）
 */
export function getMemoryCachedResourceSync(url: string | undefined): string | null {
  if (!url) return null;
  const normalizedUrl = normalizeResourceUrl(url);
  if (!normalizedUrl) return null;
  if (normalizedUrl.startsWith('data:') || normalizedUrl.startsWith('blob:') || normalizedUrl.startsWith('/')) {
    return normalizedUrl;
  }
  const cached = memoryCache.get(normalizedUrl);
  if (cached) remember(normalizedUrl, cached);
  return cached || null;
}

/** 仅返回缓存规模，供诊断使用，不暴露图片或账号信息。 */
export function getResourceMemoryCacheStats() {
  return { entries: memoryCache.size, estimatedBytes: memoryCacheBytes,
    byteLimit: MEMORY_CACHE_BYTE_LIMIT, entryByteLimit: MEMORY_CACHE_ENTRY_BYTE_LIMIT };
}

/**
 * 读取全局内存缓存并合并相同资源的并发请求。
 * 持久缓存由原生图片请求层负责，避免 WebView 缓存故障阻塞图片显示。
 */
export async function loadImageResource(url: string, fetcher: ResourceFetcher): Promise<string> {
  const normalizedUrl = normalizeResourceUrl(url);
  const generation = cacheGeneration;
  if (!normalizedUrl) return '';
  if (normalizedUrl.startsWith('data:') || normalizedUrl.startsWith('blob:') || normalizedUrl.startsWith('/')) {
    return normalizedUrl;
  }

  const memoryValue = memoryCache.get(normalizedUrl);
  if (memoryValue) {
    remember(normalizedUrl, memoryValue);
    return memoryValue;
  }

  const pending = pendingRequests.get(normalizedUrl);
  if (pending) return pending;

  const request = (async () => {
    const fetchedValue = await fetcher(normalizedUrl);
    if (generation === cacheGeneration) {
      remember(normalizedUrl, fetchedValue);
    }
    return fetchedValue;
  })();

  pendingRequests.set(normalizedUrl, request);
  try {
    return await request;
  } finally {
    if (pendingRequests.get(normalizedUrl) === request) {
      pendingRequests.delete(normalizedUrl);
    }
  }
}

/**
 * 仅清理当前进程内的资源缓存，主要用于账号切换和测试隔离。
 */
export function clearResourceMemoryCache(): void {
  cacheGeneration += 1;
  memoryCache.clear();
  memoryCacheBytes = 0;
  pendingRequests.clear();
}

/**
 * 清理当前进程内的图片缓存；原生文件缓存由后端统一清理。
 */
export async function clearResourceCache(): Promise<void> {
  clearResourceMemoryCache();
}
