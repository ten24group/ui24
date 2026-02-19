import pako from 'pako';
import { IConfigResolver } from '../core/context';

/**
 * Detect whether the browser's DecompressionStream supports a given format.
 * Caches the result so we only probe once per session.
 *
 * 'brotli' is supported in Firefox 147+ and Safari 18.4+ but isn't in
 * the TS CompressionFormat union yet, so we accept string and cast at the boundary.
 */
const _formatSupport = new Map<string, boolean>();
function supportsDecompressionFormat(format: string): boolean {
    const cached = _formatSupport.get(format);
    if (cached !== undefined) return cached;
    if (typeof DecompressionStream === 'undefined') {
        _formatSupport.set(format, false);
        return false;
    }
    try {
        new DecompressionStream(format as CompressionFormat);
        _formatSupport.set(format, true);
        return true;
    } catch {
        _formatSupport.set(format, false);
        return false;
    }
}

/**
 * Decompress an ArrayBuffer via the native DecompressionStream API.
 * Returns the decompressed text, or null if unsupported / failed.
 */
async function decompressViaStream(buffer: ArrayBuffer, format: string): Promise<string | null> {
    if (!supportsDecompressionFormat(format)) return null;
    try {
        const ds = new DecompressionStream(format as CompressionFormat);
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
 *   1. `.br` (brotli) — smallest size; uses native DecompressionStream where available
 *   2. `.gz` (gzip)  — universally supported via pako
 *   3. plain JSON     — no decompression
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
    url = withCacheBust(url, version);
    // 1. Try brotli — only if the browser's DecompressionStream supports it
    if (supportsDecompressionFormat('brotli')) {
        try {
            const brResponse = await fetch(`${url}.br`);
            if (brResponse.ok) {
                const buffer = await brResponse.arrayBuffer();
                const text = await decompressViaStream(buffer, 'brotli');
                if (text) return JSON.parse(text) as Record<string, unknown>;
            }
        } catch {
            // .br not available or decompression failed — fall through
        }
    }

    // 2. Try gzip — pako handles this regardless of browser capabilities
    try {
        const gzResponse = await fetch(`${url}.gz`);
        if (gzResponse.ok) {
            const buffer = await gzResponse.arrayBuffer();
            return JSON.parse(decompressGzip(buffer)) as Record<string, unknown>;
        }
    } catch {
        // .gz not available or decompression failed — fall through
    }

    // 3. Fallback to uncompressed JSON
    const response = await fetch(url);
    return response.json() as Promise<Record<string, unknown>>;
}

export interface LoadConfigsOptions {
    /** Cache-busting version string appended as ?v=<version> to URL-based resolvers */
    version?: string;
}

export const loadConfigs = async <T extends IConfigResolver<any>[]>(
    ...args: [...IConfigResolver<any>[]] | [...IConfigResolver<any>[], LoadConfigsOptions]
): Promise<T> => {
    let resolvers: IConfigResolver<any>[];
    let options: LoadConfigsOptions | undefined;

    const last = args[args.length - 1];
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
            } else if (typeof prop === 'object') {
                return prop
            }
        })
    );
    return configs as T;
}