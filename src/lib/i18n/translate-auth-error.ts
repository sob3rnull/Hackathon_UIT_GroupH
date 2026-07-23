import type { Locale } from "./context";

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Supabase Auth's SDK returns error text in English, generated server-side
 * by Supabase itself — not a string this codebase owns, so it can't go in
 * the dictionary as a literal. This matches the well-known messages by
 * substring and maps them to the dictionary; anything unrecognized passes
 * through in English rather than showing a broken translation.
 */
const KNOWN: { match: string; key: string }[] = [
  { match: "Invalid login credentials", key: "auth.errorInvalidCredentials" },
  { match: "Email not confirmed", key: "auth.errorEmailNotConfirmed" },
  { match: "User already registered", key: "auth.errorUserAlreadyRegistered" },
  { match: "Password should be at least", key: "auth.errorPasswordTooShort" },
  { match: "Unable to validate email address", key: "auth.errorInvalidEmail" },
  { match: "you can only request this after", key: "auth.errorRateLimited" },
  { match: "should be different from the old password", key: "auth.errorSamePassword" },
];

export function translateAuthError(message: string, t: T, locale: Locale): string {
  if (locale === "en") return message;
  const found = KNOWN.find((entry) => message.includes(entry.match));
  return found ? t(found.key) : message;
}
