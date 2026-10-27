import { NextRequest, NextResponse } from "next/server";

const ACCESS = "ek_customer_access";
const CSRF = "ek_customer_csrf";
const PREFIX = "ek_customer_backend_";
const publicReads = /^(site|pages\/(home|shop|about|contact)|categories|collections|reviews|products(?:\/[^/]+(?:\/reviews)?)?)$/;
const writes: Record<string, string> = {
  "contact/messages": "/api/v1/contact/messages", "newsletter/subscriptions": "/api/v1/newsletter/subscriptions",
  "auth/sign-in": "/auth/token", "auth/me": "/auth/me", "auth/sign-out": "/auth/logout",
  "auth/register": "/api/v1/users/", "auth/verify-otp": "/api/v1/users/verify-otp",
  "auth/verify-phone-otp": "/api/v1/users/verify-phone-otp",
  "auth/resend-otp": "/api/v1/users/resend-otp", "auth/forgot-password": "/api/v1/users/forgot_password/",
  "auth/reset-password": "/api/v1/users/reset_password",
  "auth/profile": "/api/v1/users/",
};

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.some((part) => !part || part === "." || part === ".." || /[/\\]/.test(part))) return NextResponse.json({ error: { message: "Unknown store endpoint." } }, { status: 404 });
  const key = path.join("/");
  const read = request.method === "GET" && publicReads.test(key);
  const me = key === "auth/me" && request.method === "GET";
  const profileRead = key === "auth/profile" && request.method === "GET";
  const write = request.method === "POST" && key !== "auth/me" && Object.hasOwn(writes, key);
  if (!read && !me && !profileRead && !write) return NextResponse.json({ error: { message: "Unknown store endpoint." } }, { status: 404 });
  if (write && request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: { message: "Invalid request origin." } }, { status: 403 });
  const token = request.cookies.get(ACCESS)?.value;
  if ((me || key === "auth/profile") && !token) return NextResponse.json({ error: { message: "Please sign in." } }, { status: 401 });
  const headers = new Headers({ Accept: "application/json" });
  if (token && key.startsWith("auth/")) headers.set("Authorization", `Bearer ${token}`);
  const cookies = request.cookies.getAll().filter(({ name }) => name.startsWith(PREFIX));
  if (cookies.length && key.startsWith("auth/")) headers.set("Cookie", cookies.map(({ name, value }) => `${name.slice(PREFIX.length)}=${value}`).join("; "));
  const csrf = request.cookies.get(CSRF)?.value ?? cookies.find(({ name }) => /(?:csrf|xsrf)/i.test(name))?.value;
  if (csrf && write) headers.set("X-CSRF-Token", csrf);
  try {
    let body: string | undefined;
    let method = read ? "GET" : key === "auth/reset-password" ? "PUT" : "POST";
    if (me) { body = JSON.stringify({ access_token: token }); headers.set("Content-Type", "application/json"); }
    else if (write) {
      const input = await request.json();
      if (key === "auth/sign-in") {
        body = new URLSearchParams({ username: String(input.email ?? ""), password: String(input.password ?? "") }).toString();
        headers.set("Content-Type", "application/x-www-form-urlencoded");
      } else { body = JSON.stringify(input); headers.set("Content-Type", "application/json"); }
    }
    if (me) method = "POST";
    const origin = (process.env.STORE_API_ORIGIN || "https://elizkloset.onrender.com").replace(/\/$/, "");
    let resource = read ? `/api/v1/${key.split("/").map(encodeURIComponent).join("/")}` : writes[key];
    let profileId: string | number | undefined;
    let identity: Record<string, unknown> = {};
    if (key === "auth/profile") {
      // Resolve ownership from the authenticated backend session, never a client-supplied user ID.
      headers.set("Content-Type", "application/json");
      const session = await fetch(`${origin}/auth/me`, { method: "POST", headers, body: JSON.stringify({ access_token: token }), cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30_000) });
      if (!session.ok) return NextResponse.json({ error: { message: "Unable to verify your account. Please sign in again." } }, { status: session.status, headers: { "Cache-Control": "no-store" } });
      const profile = await session.json(); const data = profile?.data ?? profile; const user = data?.user ?? data;
      if (!user || !["string", "number"].includes(typeof user.id)) throw new Error("Unsupported account profile");
      profileId = user.id; identity = user;
      resource += encodeURIComponent(String(user.id)); method = profileRead ? "GET" : "PUT";
      if (profileRead) body = undefined;
      else {
        const input = JSON.parse(body ?? "{}");
        body = JSON.stringify(Object.fromEntries(["email", "first_name", "last_name", "phone"].map((field) => [field, input[field]])));
      }
    }
    const upstream = await fetch(`${origin}${resource}${read ? new URL(request.url).search : ""}`, { method, headers, body, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(key.startsWith("auth/") ? 60_000 : 30_000) });
    const text = upstream.status === 204 ? "" : await upstream.text();
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch { return NextResponse.json({ error: { message: `The store service returned an invalid response (${upstream.status}). Please retry.` } }, { status: upstream.ok ? 502 : upstream.status }); }
    if (upstream.ok && (me || profileRead || (key === "auth/profile" && text))) {
      const envelope = data?.data ?? data; const record = envelope?.user ?? envelope;
      if (!record || typeof record !== "object" || (key === "auth/profile" && record.id !== undefined && String(record.id) !== String(profileId))) throw new Error("Unsupported account profile");
      // UserSchema contains password and OTP fields: expose profile fields only.
      const text = (...values: unknown[]) => values.find((value) => typeof value === "string" && value.trim()) as string | undefined;
      data = { data: { id: key === "auth/profile" ? profileId : record.id,
        email: text(record.email, identity.email) ?? null,
        first_name: text(record.first_name, record.firstName, record.firstname) ?? null,
        last_name: text(record.last_name, record.lastName, record.lastname) ?? null,
        phone: text(record.phone, record.phone_number, record.phoneNumber, identity.phone) ?? null,
        display_name: text(record.display_name, record.displayName, record.name, record.full_name, record.fullName) ?? null,
      } };
    }
    const payload = data?.data ?? data;
    const access = payload?.access_token ?? payload?.accessToken;
    const csrfToken = payload?.csrfToken ?? payload?.csrf_token ?? upstream.headers.get("x-csrf-token");
    if (payload && typeof payload === "object") for (const field of ["access_token", "accessToken", "refresh_token", "refreshToken"]) delete payload[field];
    const response = upstream.status === 204 ? new NextResponse(null, { status: 204 }) : NextResponse.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store"); response.headers.set("Vary", "Cookie");
    for (const name of ["retry-after", "x-request-id"]) { const value = upstream.headers.get(name); if (value) response.headers.set(name, value); }
    const secure = new URL(request.url).protocol === "https:";
    const options = { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/store" };
    if (upstream.ok && key === "auth/sign-in" && typeof access === "string") response.cookies.set(ACCESS, access, options);
    if (typeof csrfToken === "string" && csrfToken) response.cookies.set(CSRF, csrfToken, options);
    for (const cookie of upstream.headers.getSetCookie()) {
      const separator = cookie.indexOf("=");
      if (separator < 1) continue;
      let value = PREFIX + cookie.slice(0, separator) + cookie.slice(separator).replace(/;\s*(Domain|Path)=[^;]+/gi, "").replace(/;\s*(HttpOnly|Secure)(?=;|$)/gi, "");
      value += `; Path=/api/store; HttpOnly${secure ? "; Secure" : ""}`;
      response.headers.append("Set-Cookie", value);
    }
    if (key === "auth/sign-out" && (upstream.ok || upstream.status === 401)) for (const name of [ACCESS, CSRF, ...cookies.map((cookie) => cookie.name)]) response.cookies.set(name, "", { ...options, maxAge: 0 });
    return response;
  } catch (error) {
    const timeout = error && typeof error === "object" && "name" in error && ["TimeoutError", "AbortError"].includes(String(error.name));
    return NextResponse.json({ error: { message: timeout ? "The store service took too long to respond. Please retry shortly." : "The store service could not be reached. Please try again." } }, { status: timeout ? 504 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
export { proxy as GET, proxy as POST };
