import { customAlphabet } from "nanoid";

// URL-safe alphanumeric characters (no ambiguous chars like 0/O, 1/l/I)
const nanoidAlpha = customAlphabet(
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz",
  8,
);

const nanoidSlug = customAlphabet(
  "23456789abcdefghjkmnpqrstuvwxyz",
  6,
);

export function generateRefCode(): string {
  return nanoidAlpha();
}

export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
  return `${base}-${nanoidSlug()}`;
}
