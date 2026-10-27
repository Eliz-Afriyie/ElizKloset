const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-module.cjs");
const schema = require("../backend-openapi.json");
const stored = new Map();
const storage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) };
const otp = load("app/admin/lib/otp.ts", {}, { sessionStorage: storage });
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; stored.clear(); });
const challengeId = "test-challenge-1234567890";
const email = "test@example.com";

test("OTP challenge accepts the admin response and uses the earlier expiry", () => {
  const now = Date.parse("2026-10-26T10:00:00Z");
  const pending = otp.parseOtpChallenge({ data: { status: "mfa_required", challengeId, expiresAt: "2026-10-26T10:02:00Z" } }, email, now);
  assert.equal(pending.challengeId, challengeId);
  assert.equal(pending.expiresAt, "2026-10-26T10:02:00.000Z");
  assert.equal(otp.parseOtpChallenge({ data: { status: "mfa_required", challengeId } }, email, now).expiresAt, "2026-10-26T10:05:00.000Z");
});

test("missing, malformed and expired OTP challenges cannot enter verification", () => {
  assert.throws(() => otp.parseOtpChallenge({ data: { status: "mfa_required" } }, email), /valid OTP challenge/);
  assert.throws(() => otp.parseOtpChallenge({ data: { status: "otp_required", challengeId: "short" } }, email), /valid OTP challenge/);
  assert.throws(() => otp.parseOtpChallenge({ data: { status: "mfa_required", challengeId, expiresAt: "2020-01-01T00:00:00Z" } }, email), /expired/);
  assert.equal(otp.parseOtpChallenge({ data: { status: "authenticated" } }, email), null);
});

test("tab recovery stores only challenge metadata and removes it when expired or cancelled", () => {
  const now = Date.now();
  const pending = otp.parseOtpChallenge({ data: { status: "mfa_required", challengeId } }, email, now);
  otp.savePendingOtp(pending);
  const raw = [...stored.values()][0];
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ["challengeId", "email", "expiresAt"].sort());
  assert.equal(otp.readPendingOtp(now).challengeId, challengeId);
  assert.equal(otp.readPendingOtp(now + 300001), null);
  assert.equal(stored.size, 0);
  otp.savePendingOtp(pending); otp.savePendingOtp(null);
  assert.equal(otp.readPendingOtp(now), null);
});

test("OTP verification sends the documented challengeId/code payload and preserves leading zeros", async () => {
  const pending = otp.parseOtpChallenge({ data: { status: "mfa_required", challengeId } }, email);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/auth/mfa"); assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { challengeId, code: "001234" });
    return Response.json({ data: { status: "authenticated" } });
  };
  await otp.submitStaffOtp(pending, "001234");
  assert.deepEqual(Object.keys(schema.components.schemas.StaffMfaVerifySchema.properties).sort(), ["challengeId", "code"].sort());
});

test("invalid and expired codes are rejected without an API call, while backend failures remain failures", async () => {
  const pending = otp.parseOtpChallenge({ data: { status: "mfa_required", challengeId } }, email);
  globalThis.fetch = () => { throw new Error("Must not call API"); };
  await assert.rejects(() => otp.submitStaffOtp(pending, "12345"), /six-digit/);
  await assert.rejects(() => otp.submitStaffOtp({ ...pending, expiresAt: "2020-01-01T00:00:00Z" }, "123456"), /expired/);
  globalThis.fetch = async () => Response.json({ error: { message: "Incorrect verification code." } }, { status: 401 });
  await assert.rejects(() => otp.submitStaffOtp(pending, "123456"), /Incorrect verification code/);
});
