import { adminRequest, unwrap } from "./api";

export type PendingOtp = { challengeId: string; email: string; expiresAt: string };
const key = "elizkloset-admin-pending-otp";
const clientLifetime = 5 * 60 * 1000;

export function parseOtpChallenge(response: unknown, email: string, now = Date.now()): PendingOtp | null {
  const result = unwrap(response);
  if (!result || typeof result !== "object") throw new Error("The API returned an unsupported sign-in response.");
  const value = result as { status?: string; challengeId?: string; expiresAt?: string };
  if (!value.challengeId && value.status !== "mfa_required" && value.status !== "otp_required") return null;
  if (typeof value.challengeId !== "string" || value.challengeId.length < 16 || value.challengeId.length > 128) throw new Error("The API did not return a valid OTP challenge. Please start sign-in again.");
  const expiry = value.expiresAt !== undefined ? Date.parse(value.expiresAt) : now + clientLifetime;
  if (!Number.isFinite(expiry) || expiry <= now) throw new Error("This verification request has expired. Please start sign-in again.");
  return { challengeId: value.challengeId, email, expiresAt: new Date(Math.min(expiry, now + clientLifetime)).toISOString() };
}

// Only the short-lived challenge and email are retained in this tab. Passwords,
// OTP values and access/refresh tokens are never stored here.
export function savePendingOtp(challenge: PendingOtp | null) {
  try { if (challenge) sessionStorage.setItem(key, JSON.stringify(challenge)); else sessionStorage.removeItem(key); } catch { /* In-memory verification still works when storage is unavailable. */ }
}
export function readPendingOtp(now = Date.now()): PendingOtp | null {
  try {
    const stored = sessionStorage.getItem(key); if (!stored) return null;
    const value = JSON.parse(stored);
    if (typeof value.email !== "string" || typeof value.expiresAt !== "string") throw new Error("Invalid pending challenge");
    const result = parseOtpChallenge(value, value.email, now);
    if (!result) throw new Error("Missing pending challenge");
    return result;
  } catch { savePendingOtp(null); return null; }
}
export async function submitStaffOtp(challenge: PendingOtp, code: string) {
  if (Date.parse(challenge.expiresAt) <= Date.now()) throw new Error("This verification request has expired. Please start sign-in again.");
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the six-digit verification code.");
  await adminRequest("auth/mfa", { method: "POST", body: { challengeId: challenge.challengeId, code } });
}
