import { createHash } from "crypto";

const HASH_SALT = process.env.HASH_SALT ?? "dev-salt";

/**
 * Returns a stable SHA-256 hex digest salted with HASH_SALT.
 * Used for anonymising IP addresses and User-Agent strings.
 */
export function hashString(value: string): string {
  return createHash("sha256")
    .update(HASH_SALT + value)
    .digest("hex");
}

/**
 * Extracts and hashes the client IP from a Next.js Request.
 */
export function hashIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip");
  return ip ? hashString(ip) : null;
}

/**
 * Extracts and hashes the User-Agent from a Next.js Request.
 */
export function hashUserAgent(req: Request): string | null {
  const ua = req.headers.get("user-agent");
  return ua ? hashString(ua) : null;
}
