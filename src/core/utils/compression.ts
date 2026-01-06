/**
 * Compression utilities for UI24
 * 
 * Detects and decompresses compressed payloads from fw24 observability system.
 */

import pako from 'pako';

export interface CompressedPayload {
  _compressed: true;
  _algorithm: 'gzip';
  _data: string;
  _originalSize: number;
  _compressedSize: number;
}

/**
 * Check if a value is a compressed payload
 */
export function isCompressed(value: unknown): value is CompressedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_compressed' in value &&
    (value as any)._compressed === true &&
    '_algorithm' in value &&
    '_data' in value
  );
}

/**
 * Decompress a compressed payload
 */
export function decompress(value: unknown): unknown {
  if (!isCompressed(value)) {
    return value;
  }

  try {
    if (value._algorithm !== 'gzip') {
      console.error(`Unsupported compression algorithm: ${value._algorithm}`);
      return value;
    }

    // Decode base64 to Uint8Array
    const binaryString = atob(value._data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[ i ] = binaryString.charCodeAt(i);
    }

    // Decompress with pako
    const decompressed = pako.ungzip(bytes, { to: 'string' });
    return JSON.parse(decompressed);
  } catch (error) {
    console.error('Failed to decompress payload:', error);
    return value; // Return original on error
  }
}

/**
 * Decompress all compressed fields in an object
 */
export function decompressItem<T extends Record<string, unknown>>(item: T): T {
  const result = { ...item } as Record<string, unknown>;

  for (const key in result) {
    if (isCompressed(result[ key ])) {
      result[ key ] = decompress(result[ key ]);
    } else if (result[ key ] && typeof result[ key ] === 'object' && !Array.isArray(result[ key ])) {
      // Recursively decompress nested objects
      result[ key ] = decompressItem(result[ key ] as Record<string, unknown>);
    }
  }

  return result as T;
}
