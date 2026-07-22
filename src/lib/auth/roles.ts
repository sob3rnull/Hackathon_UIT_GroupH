/** The three MediRoute roles. Mirrors profiles.role in migration 0007. */
export type Role = "dispatcher" | "ambulance" | "hospital";

export const ROLES: Role[] = ["dispatcher", "ambulance", "hospital"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

/** Where each role lands after sign-in, and where it bounces back to. */
export const HOME: Record<Role, string> = {
  dispatcher: "/dispatcher",
  ambulance: "/ambulance",
  hospital: "/hospital",
};

/**
 * Which roles may enter which route prefix. Order matters: the first matching
 * prefix wins, so list more specific paths first if they ever overlap.
 */
export const GUARD: ReadonlyArray<readonly [string, readonly Role[]]> = [
  ["/dispatcher", ["dispatcher"]],
  ["/fleet", ["dispatcher"]],
  ["/history", ["dispatcher"]],
  ["/ambulance", ["ambulance"]],
  ["/hospital", ["hospital"]],
];

/** Paths reachable without a session. */
export function isPublicPath(path: string): boolean {
  return (
    path === "/login" ||
    path === "/reset-password" ||
    path === "/update-password" ||
    path.startsWith("/auth/")
  );
}

/**
 * Paths a signed-in user should be bounced away from.
 *
 * Deliberately excludes /update-password: password recovery hands the user a
 * session before they reach that screen, so treating it like /login would make
 * it permanently unreachable. /auth/* is excluded for the same reason — the
 * callback route needs to run while a session exists.
 */
export function isSignedOutOnlyPath(path: string): boolean {
  return path === "/login" || path === "/reset-password";
}

/**
 * Rejects open redirects. Only same-origin absolute paths survive; "//evil.com"
 * and "https://evil.com" are protocol-relative / absolute URLs and must not be
 * followed after sign-in.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export function allowedOn(path: string, role: Role): boolean {
  const rule = GUARD.find(([prefix]) => path.startsWith(prefix));
  return !rule || rule[1].includes(role);
}
