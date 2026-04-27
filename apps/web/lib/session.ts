import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import type { UserRole } from "@bags/shared";

export interface SessionData {
  walletAddress: string;
  role: UserRole;
}

export const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET ?? "dev-secret-change-me-32-chars-min!",
  cookieName: "bags-attribution-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

/**
 * Resolves the iron-session from Next.js cookies.
 * Call with no arguments from Route Handlers / Server Components.
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore as never, SESSION_OPTIONS);
}
