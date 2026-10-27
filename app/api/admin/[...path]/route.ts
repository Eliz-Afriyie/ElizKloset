import { NextRequest, NextResponse } from "next/server";

const DEFAULT_API = "https://elizkloset.onrender.com/api/v1";
const TOKEN_COOKIE = "ek_admin_access";
const CSRF_COOKIE = "ek_proxy_csrf";
const allowed = new Set(["auth", "products", "assets", "categories", "collections", "orders", "customers", "dashboard", "pages", "site", "reviews", "settings", "staff"]);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!allowed.has(path[0]) || path.some((part) => !part || part === "." || part === ".." || /[/\\]/.test(part))) {
    return NextResponse.json({ error: { message: "Unknown admin endpoint." } }, { status: 404 });
  }
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: { message: "Invalid request origin." } }, { status: 403 });
  }
  const headers = new Headers({ Accept: "application/json" });
  for (const name of ["content-type", "if-match", "x-csrf-token", "idempotency-key"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Keep credentials in HttpOnly cookies. Never return bearer tokens to browser JS.
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);
  const cookies = request.cookies.getAll().filter((cookie) => ![TOKEN_COOKIE, CSRF_COOKIE].includes(cookie.name));
  if (cookies.length) headers.set("cookie", cookies.map(({ name, value }) => `${name}=${value}`).join("; "));
  // The browser cannot read cookies scoped to /api/admin and marked HttpOnly.
  // Attach the backend-issued token only after the same-origin write check above.
  if (!["GET", "HEAD"].includes(request.method) && !headers.has("x-csrf-token")) {
    const csrf = request.cookies.get(CSRF_COOKIE)?.value ?? cookies.find(({ name }) => /(?:^|[_-])(?:csrf|xsrf)(?:[_-]?token)?$/i.test(name))?.value;
    if (csrf) headers.set("x-csrf-token", csrf);
  }
  try {
    const base = (process.env.ADMIN_API_BASE_URL || DEFAULT_API).replace(/\/$/, "");
    const upstream = await fetch(`${base}/admin/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`, {
      method: request.method, headers, cache: "no-store", redirect: "manual",
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      signal: AbortSignal.timeout(path[0] === "auth" ? 60_000 : 30_000),
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store", Vary: "Cookie" });
    for (const name of ["content-type", "etag", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) {
      // Backend cookies must target this same-origin proxy, including in local dev.
      let value = cookie.replace(/;\s*Domain=[^;]+/gi, "").replace(/;\s*Path=[^;]+/gi, "");
      value += "; Path=/api/admin; HttpOnly";
      if (process.env.NODE_ENV === "development") value = value.replace(/;\s*Secure/gi, "");
      responseHeaders.append("Set-Cookie", value);
    }
    let body = upstream.status === 204 ? null : await upstream.text();
    const response = new NextResponse(body, { status: upstream.status, headers: responseHeaders });
    function rememberCsrf(value: unknown) {
      if (typeof value === "string" && value) response.cookies.set(CSRF_COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/admin" });
    }
    rememberCsrf(upstream.headers.get("x-csrf-token"));
    if (upstream.ok && path[0] === "auth" && ["sign-in", "mfa"].includes(path[1]) && body) {
      let parsed;
      try { parsed = JSON.parse(body); }
      catch {
        return NextResponse.json({ error: { code: "UPSTREAM_INVALID_RESPONSE", message: "The sign-in service returned an invalid response. Please try again or contact the store administrator." } }, { status: 502, headers: { "Cache-Control": "no-store" } });
      }
      if (!parsed || typeof parsed !== "object" || !(parsed.data ?? parsed) || typeof (parsed.data ?? parsed) !== "object") {
        return NextResponse.json({ error: { code: "UPSTREAM_INVALID_RESPONSE", message: "The sign-in service returned an invalid response. Please contact the store administrator." } }, { status: 502, headers: { "Cache-Control": "no-store" } });
      }
      const payload = parsed.data ?? parsed;
      rememberCsrf(payload.csrfToken ?? payload.csrf_token ?? parsed.csrfToken ?? parsed.csrf_token);
      const accessToken = payload.access_token ?? payload.accessToken;
      if (typeof accessToken === "string") {
        response.cookies.set(TOKEN_COOKIE, accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/admin" });
        delete payload.access_token; delete payload.accessToken;
        delete payload.refresh_token; delete payload.refreshToken;
        body = JSON.stringify(parsed);
        return new NextResponse(body, { status: upstream.status, headers: response.headers });
      }
    }
    if (path[0] === "auth" && path[1] === "sign-out" && upstream.ok) {
      response.cookies.set(TOKEN_COOKIE, "", { httpOnly: true, path: "/api/admin", maxAge: 0 });
      response.cookies.set(CSRF_COOKIE, "", { httpOnly: true, path: "/api/admin", maxAge: 0 });
    }
    return response;
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && ["TimeoutError", "AbortError"].includes(String(error.name))) {
      return NextResponse.json({ error: { code: "UPSTREAM_TIMEOUT", message: "The store API took too long to respond. Please wait a moment and try again." } }, { status: 504, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: { code: "UPSTREAM_UNAVAILABLE", message: "The store API could not be reached. Please try again." } }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
