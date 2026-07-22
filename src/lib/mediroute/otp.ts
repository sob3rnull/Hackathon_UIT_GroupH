import "server-only";

/**
 * One-time codes for confirming wallet payments on the public page.
 *
 * Demo constraints, stated rather than hidden: there is no SMS gateway, so
 * the code is returned to the client and shown in a "Demo SMS" box instead
 * of being texted. The verification mechanics are real — random code,
 * expiry, limited attempts, consumed on success — so swapping in a real
 * SMS provider later only changes where the code is delivered.
 */

interface PendingOtp {
  code: string;
  expiresAt: number;
  attemptsLeft: number;
}

const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const g = globalThis as unknown as { __otps?: Map<string, PendingOtp> };

function pending(): Map<string, PendingOtp> {
  g.__otps ??= new Map();
  return g.__otps;
}

/** Six digits, crypto-random, no leading-zero loss. */
function generateCode(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return String(buffer[0] % 1_000_000).padStart(6, "0");
}

export function requestOtp(phone: string): string {
  const code = generateCode();
  pending().set(phone, {
    code,
    expiresAt: Date.now() + TTL_MS,
    attemptsLeft: MAX_ATTEMPTS,
  });
  return code;
}

export function verifyOtp(phone: string, code: string): boolean {
  const entry = pending().get(phone);
  if (!entry) return false;

  if (Date.now() > entry.expiresAt || entry.attemptsLeft <= 0) {
    pending().delete(phone);
    return false;
  }

  entry.attemptsLeft -= 1;
  if (entry.code !== code.trim()) return false;

  pending().delete(phone);
  return true;
}
