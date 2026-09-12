import { gzipSync, gunzipSync } from "zlib";

const GZIP_PREFIX = "__gz:";
const DEFAULT_COMPRESSION_THRESHOLD_BYTES = 1024; // 1 KB

/**
 * Serializes and optionally compresses data if payload size exceeds the threshold.
 * Reduces Redis memory footprint by 70-90% on large datasets.
 */
export function compressPayload(
  data: any,
  thresholdBytes: number = DEFAULT_COMPRESSION_THRESHOLD_BYTES
): string {
  if (data === undefined || data === null) {
    return JSON.stringify(data);
  }

  const rawJson = typeof data === "string" ? data : JSON.stringify(data);

  // If payload is smaller than threshold, return raw JSON string
  if (Buffer.byteLength(rawJson, "utf8") < thresholdBytes) {
    return rawJson;
  }

  try {
    const compressedBuffer = gzipSync(Buffer.from(rawJson, "utf8"), { level: 6 });
    return GZIP_PREFIX + compressedBuffer.toString("base64");
  } catch (err) {
    console.warn("[COMPRESSION] Gzip compression failed, storing raw JSON:", err);
    return rawJson;
  }
}

/**
 * Decompresses and deserializes data retrieved from Redis.
 * Transparently handles both compressed (__gz: prefix) and uncompressed payloads.
 */
export function decompressPayload<T = any>(payload: string | null): T | null {
  if (payload === null || payload === undefined) {
    return null;
  }

  try {
    if (payload.startsWith(GZIP_PREFIX)) {
      const base64Data = payload.slice(GZIP_PREFIX.length);
      const buffer = Buffer.from(base64Data, "base64");
      const decompressedBuffer = gunzipSync(buffer);
      const jsonStr = decompressedBuffer.toString("utf8");
      return JSON.parse(jsonStr) as T;
    }

    return JSON.parse(payload) as T;
  } catch (err) {
    console.warn("[COMPRESSION] Decompression / JSON parse failed:", err);
    return null;
  }
}
