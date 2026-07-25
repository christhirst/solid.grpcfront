import { getSession } from "@auth/solid-start";
import { authOpts } from "~/routes/api/auth/[...solidauth]";

export interface AuthUser {
  sub: string;
  name?: string;
  email?: string;
  image?: string;
}

/**
 * Extract the authenticated user from a request, or return null if not logged in.
 */
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  try {
    const session = await getSession(request, authOpts);
    if (!session?.user) return null;
    const user = session.user as any;
    return {
      sub: user.sub || user.id || "anonymous",
      name: user.name || undefined,
      email: user.email || undefined,
      image: user.image || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Get the owner ID string from a request, falling back to "anonymous".
 */
export async function getOwnerFromRequest(request: Request): Promise<string> {
  const user = await getAuthUser(request);
  return user?.sub || "anonymous";
}
