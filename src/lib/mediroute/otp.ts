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

/** Minimum gap between two sends to the same number. */
const COOLDOWN_MS = 60 * 1000;
/** Rolling window and its cap, so a number can't be paged all day. */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

const g = globalThis as unknown as {
  __otps?: Map<string, PendingOtp>;
  __otpSends?: Map<string, number[]>;
};

function pending(): Map<string, PendingOtp> {
  g.__otps ??= new Map();
  return g.__otps;
}

/** Send timestamps per number, kept separately so consuming a code doesn't
 *  wipe the history and hand the caller a fresh quota. */
function sends(): Map<string, number[]> {
  g.__otpSends ??= new Map();
  return g.__otpSends;
}

/**
 * Both maps are keyed by caller-supplied input, so without this they grow
 * without bound — a slow memory exhaustion attack from a public endpoint.
 * Cheap enough to run on every request at demo volumes.
 */
function prune(now: number): void {
  for (const [phone, entry] of pending()) {
    if (now > entry.expiresAt) pending().delete(phone);
  }
  for (const [phone, history] of sends()) {
    const live = history.filter((at) => now - at < WINDOW_MS);
    if (live.length === 0) sends().delete(phone);
    else if (live.length !== history.length) sends().set(phone, live);
  }
}

export type OtpRequest =
  | { ok: true; code: string; expiresInMinutes: number }
  | { ok: false; retryAfterSeconds: number };

/** Six digits, crypto-random, no leading-zero loss. */
function generateCode(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return String(buffer[0] % 1_000_000).padStart(6, "0");
}

export function requestOtp(phone: string): OtpRequest {
  const now = Date.now();
  prune(now);

  const history = sends().get(phone) ?? [];

  // Re-requesting used to mint a fresh code AND reset attemptsLeft, so five
  // wrong guesses cost nothing — you just asked for another code. The cooldown
  // is what makes MAX_ATTEMPTS mean something.
  const last = history[history.length - 1];
  if (last !== undefined && now - last < COOLDOWN_MS) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((COOLDOWN_MS - (now - last)) / 1000),
    };
  }

  if (history.length >= MAX_PER_WINDOW) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((WINDOW_MS - (now - history[0])) / 1000),
    };
  }

  sends().set(phone, [...history, now]);

  const code = generateCode();
  pending().set(phone, {
    code,
    expiresAt: now + TTL_MS,
    attemptsLeft: MAX_ATTEMPTS,
  });

  return { ok: true, code, expiresInMinutes: TTL_MS / 60_000 };
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
