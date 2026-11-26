import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export class SafeAppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeAppError";
  }
}

interface RateBucket {
  timestamps: number[];
}

const globalRateStore = globalThis as unknown as {
  __iskedRateMap?: Map<string, RateBucket>;
};

const rateMap =
  globalRateStore.__iskedRateMap ?? new Map<string, RateBucket>();
if (!globalRateStore.__iskedRateMap) {
  globalRateStore.__iskedRateMap = rateMap;
}

const IP_PATTERN = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * Resolves the client IP without trusting attacker-controlled header values.
 *
 * - On Vercel, `x-real-ip` is set by the platform edge and cannot be spoofed.
 * - Elsewhere, the RIGHT-most `x-forwarded-for` entry is used, because that entry is
 *   appended by the nearest (trusted) proxy. The left-most entry is client-supplied
 *   and would let attackers rotate fake IPs to bypass rate limits.
 */
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();

    if (process.env.VERCEL) {
      const realIp = h.get("x-real-ip")?.trim();
      if (realIp && IP_PATTERN.test(realIp)) return realIp;
    }

    const forwarded = h.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const nearest = parts[parts.length - 1];
      if (nearest && IP_PATTERN.test(nearest)) return nearest;
    }

    const realIp = h.get("x-real-ip")?.trim();
    if (realIp && IP_PATTERN.test(realIp)) return realIp;
    return "unknown";
  } catch {
    return "unknown";
  }
}

function hashIdentifier(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  if (rateMap.size > 5000) {
    for (const [k, v] of rateMap.entries()) {
      if (v.timestamps.every((t) => t <= cutoff)) {
        rateMap.delete(k);
      }
    }
  }

  const bucket = rateMap.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    rateMap.set(key, bucket);
    return false;
  }

  bucket.timestamps.push(now);
  rateMap.set(key, bucket);
  return true;
}

/**
 * Persistent fixed-window rate limiter backed by PostgreSQL, so limits survive
 * server restarts and are shared across every serverless/container instance.
 *
 * Keyed by namespace + SHA-256 hash of the identifier (client IP by default, or a
 * custom identifier such as a login email / booking UID). Falls back to an
 * in-memory limiter if the database is temporarily unreachable.
 */
export async function checkRateLimit(params: {
  namespace: string;
  limit: number;
  windowMs: number;
  identifier?: string;
}): Promise<boolean> {
  const rawIdentifier =
    params.identifier?.trim().toLowerCase() || (await getClientIp());
  const idHash = hashIdentifier(rawIdentifier);
  const now = Date.now();
  const windowIndex = Math.floor(now / params.windowMs);
  const key = `${params.namespace}:${idHash}:${windowIndex}`;
  const expiresAt = new Date((windowIndex + 1) * params.windowMs);

  try {
    const row = await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    // Opportunistic cleanup of expired counters (non-blocking, ~2% of calls)
    if (Math.random() < 0.02) {
      prisma.rateLimit
        .deleteMany({ where: { expiresAt: { lt: new Date() } } })
        .catch(() => {});
    }

    return row.count <= params.limit;
  } catch (err) {
    console.error("Rate limiter DB fallback:", (err as Error)?.message);
    return checkMemoryRateLimit(
      `${params.namespace}:${idHash}`,
      params.limit,
      params.windowMs
    );
  }
}

/**
 * Generates a 192-bit cryptographically random URL-safe booking identifier,
 * preventing sequential enumeration of public /booking/[uid] endpoints.
 */
export function generateSecureBookingUid(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Escapes untrusted user strings before interpolating into HTML email templates.
 */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Masks an email address for public unauthenticated confirmation/cancellation pages
 * (e.g., "juan.delacruz@example.com" -> "ju***@example.com").
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

/**
 * Timing-safe case-insensitive email match check.
 */
export function emailsMatchTimingSafe(a: string, b: string): boolean {
  const normA = Buffer.from(a.trim().toLowerCase(), "utf8");
  const normB = Buffer.from(b.trim().toLowerCase(), "utf8");
  if (normA.length !== normB.length) {
    return false;
  }
  return timingSafeEqual(normA, normB);
}

/**
 * Blocks internal, loopback, link-local, and cloud metadata hostnames.
 */
export function isInternalOrMetadataHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "metadata.google.internal" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

/**
 * Validates post-booking external redirect URLs, strictly allowing only http:/https:
 * and blocking dangerous schemes and internal/cloud-metadata hosts.
 */
export function sanitizeRedirectUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (
      process.env.NODE_ENV === "production" &&
      isInternalOrMetadataHost(parsed.hostname)
    ) {
      return null;
    }
    if (parsed.hostname === "169.254.169.254") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
