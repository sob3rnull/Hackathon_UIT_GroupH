import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestOtp, verifyOtp } from "./otp";

const PHONE = "09771234567";

/** Both maps hang off globalThis, so tests would otherwise leak into each other. */
function resetState() {
  const g = globalThis as unknown as { __otps?: unknown; __otpSends?: unknown };
  delete g.__otps;
  delete g.__otpSends;
}

/** Narrow the union; a failure here means the request was rate-limited. */
function expectCode(result: ReturnType<typeof requestOtp>): string {
  if (!result.ok) throw new Error("expected a code, got rate-limited");
  return result.code;
}

beforeEach(() => {
  resetState();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("requestOtp rate limiting", () => {
  it("issues a six-digit code on the first request", () => {
    const code = expectCode(requestOtp(PHONE));
    expect(code).toMatch(/^\d{6}$/);
  });

  it("refuses a second send inside the cooldown", () => {
    requestOtp(PHONE);
    const second = requestOtp(PHONE);

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.retryAfterSeconds).toBeGreaterThan(0);
    expect(second.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("allows another send once the cooldown has passed", () => {
    requestOtp(PHONE);
    vi.advanceTimersByTime(60_000);
    expect(requestOtp(PHONE).ok).toBe(true);
  });

  it("caps sends per rolling hour", () => {
    for (let i = 0; i < 5; i++) {
      expect(requestOtp(PHONE).ok).toBe(true);
      vi.advanceTimersByTime(60_000);
    }
    // Sixth inside the same hour, cooldown already satisfied.
    expect(requestOtp(PHONE).ok).toBe(false);
  });

  it("lets the window slide rather than locking the number out forever", () => {
    for (let i = 0; i < 5; i++) {
      requestOtp(PHONE);
      vi.advanceTimersByTime(60_000);
    }
    expect(requestOtp(PHONE).ok).toBe(false);

    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(requestOtp(PHONE).ok).toBe(true);
  });

  it("rate-limits each number independently", () => {
    requestOtp(PHONE);
    expect(requestOtp("09779999999").ok).toBe(true);
  });
});

describe("verifyOtp", () => {
  it("accepts the issued code exactly once", () => {
    const code = expectCode(requestOtp(PHONE));
    expect(verifyOtp(PHONE, code)).toBe(true);
    expect(verifyOtp(PHONE, code)).toBe(false);
  });

  it("rejects an expired code", () => {
    const code = expectCode(requestOtp(PHONE));
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(verifyOtp(PHONE, code)).toBe(false);
  });

  it("burns attempts on wrong guesses and the cooldown stops them being refilled", () => {
    const code = expectCode(requestOtp(PHONE));

    for (let i = 0; i < 5; i++) {
      expect(verifyOtp(PHONE, "000000")).toBe(false);
    }

    // The real code no longer works — attempts are spent.
    expect(verifyOtp(PHONE, code)).toBe(false);

    // And the attacker can't immediately mint a fresh code to reset the count,
    // which is precisely what the cooldown is protecting.
    expect(requestOtp(PHONE).ok).toBe(false);
  });
});
