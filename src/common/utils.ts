import pako from 'pako';
import { IConfigResolver } from '../core/context';

/**
 * Decompress a gzip ArrayBuffer via the native DecompressionStream API.
 * Returns the decompressed text, or null if unsupported / failed.
 *
 * NOTE: We only use this for gzip. Brotli via DecompressionStream was removed
 * because Chrome accepts the constructor but silently fails on actual decompression
 * (only 'gzip' and 'deflate'/'deflate-raw' are reliably supported across browsers).
 */
function supportsNativeGzip(): boolean {
    if (typeof DecompressionStream === 'undefined') return false;
    try {
        new DecompressionStream('gzip');
        return true;
    } catch {
        return false;
    }
}
const _nativeGzip = supportsNativeGzip();

async function decompressGzipViaStream(buffer: ArrayBuffer): Promise<string | null> {
    if (!_nativeGzip) return null;
    try {
        const ds = new DecompressionStream('gzip');
        const decompressedStream = new Blob([ buffer ]).stream().pipeThrough(ds);
        return await new Response(decompressedStream).text();
    } catch {
        return null;
    }
}

/**
 * Decompress a gzip ArrayBuffer to a string using pako.
 */
function decompressGzip(buffer: ArrayBuffer): string {
    return pako.ungzip(new Uint8Array(buffer), { to: 'string' });
}

/**
 * Fetch a single config URL with compressed variant fallback.
 *
 * Resolution order:
 *   1. `.gz` (gzip) — universally supported via pako / native DecompressionStream
 *   2. plain JSON    — no decompression
 *
 * Brotli was removed: Chrome's DecompressionStream constructor accepts 'brotli'
 * without throwing, but actual decompression silently produces empty output.
 *
 * S3 static files are uploaded as pre-compressed variants, so the
 * client explicitly fetches the compressed file and decompresses locally.
 */
/**
 * Append a cache-busting query parameter to a URL.
 * If `version` is provided, appends `?v=<version>`.
 */
function withCacheBust(url: string, version?: string): string {
    if (!version) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${encodeURIComponent(version)}`;
}

async function loadConfigUrl(url: string, version?: string): Promise<Record<string, unknown>> {
    // Cache bust is applied per-variant AFTER the extension so the URL is
    // correctly formed: url.gz?v=123, NOT url?v=123.gz

    // 1. Try gzip — native DecompressionStream when available, pako fallback
    try {
        const gzUrl = withCacheBust(`${url}.gz`, version);
        const gzResponse = await fetch(gzUrl);
        if (gzResponse.ok) {
            const buffer = await gzResponse.arrayBuffer();
            const text = await decompressGzipViaStream(buffer);
            if (text) return JSON.parse(text) as Record<string, unknown>;
            return JSON.parse(decompressGzip(buffer)) as Record<string, unknown>;
        }
    } catch {
        // compressed variant unavailable — silent fallthrough
    }

    // 2. Fallback to uncompressed JSON — this is the final attempt, so errors propagate
    const plainUrl = withCacheBust(url, version);
    const response = await fetch(plainUrl);
    if (!response.ok) {
        throw new Error(`Failed to load config from ${url} (HTTP ${response.status})`);
    }
    return response.json() as Promise<Record<string, unknown>>;
}

export interface LoadConfigsOptions {
    /** Cache-busting version string appended as ?v=<version> to URL-based resolvers */
    version?: string;
}

export const loadConfigs = async <T extends IConfigResolver<any>[]>(
    ...args: [ ...IConfigResolver<any>[] ] | [ ...IConfigResolver<any>[], LoadConfigsOptions ]
): Promise<T> => {
    let resolvers: IConfigResolver<any>[];
    let options: LoadConfigsOptions | undefined;

    const last = args[ args.length - 1 ];
    if (last && typeof last === 'object' && !Array.isArray(last) && 'version' in last) {
        options = last as LoadConfigsOptions;
        resolvers = args.slice(0, -1) as IConfigResolver<any>[];
    } else {
        resolvers = args as IConfigResolver<any>[];
    }

    const configs = await Promise.all(
        resolvers.map(async (prop) => {
            if (typeof prop === 'function') {
                return await prop()
            } else if (typeof prop === 'string') {
                return await loadConfigUrl(prop, options?.version);
            } else if (prop != null && typeof prop === 'object') {
                return prop
            }
            return {} as Record<string, unknown>;
        })
    );
    return configs as T;
}