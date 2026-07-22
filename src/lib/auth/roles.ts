/** The three MediRoute roles. Mirrors profiles.role in migration 0005. */
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

export function allowedOn(path: string, role: Role): boolean {
  const rule = GUARD.find(([prefix]) => path.startsWith(prefix));
  return !rule || rule[1].includes(role);
}
