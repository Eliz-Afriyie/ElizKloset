// Optional visual/interaction check. API fixtures are intercepted in this isolated
// browser only; no production credentials or store records are used.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

const base = process.env.ADMIN_CHECK_URL || "http://localhost:3100";
const checkLogin = process.argv.includes("--login");
const browserPath = process.env.ADMIN_CHECK_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const permissions = ["dashboard:read", "catalog:read", "catalog:write", "orders:read", "orders:write", "customers:read", "customers:write", "customers:delete", "content:read", "content:write", "reviews:moderate", "settings:write", "staff:manage"];
const money = (amount) => ({ amount, currency: "GHS" });
const staff = { id: "browser-test-owner", name: "Test owner", email: "owner@example.com", role: "owner", permissions };
const sales = [42000, 64000, 48000, 80000, 56000, 96000, 74000].map((amount, index) => ({ date: `2026-10-${20 + index}`, revenue: money(amount), paidOrders: [3, 4, 3, 5, 4, 6, 5][index] }));
const dashboard = { stats: { paidRevenue: money(sales.reduce((sum, item) => sum + item.revenue.amount, 0)), paidOrders: 30, orders: 36, catalogStyles: 24, stockAttention: 3 }, sales, orderStatuses: [{ status: "delivered", count: 22 }, { status: "cancelled", count: 2 }], topProducts: [{ productId: "test-dress", name: "Royal Blue Wrap Dress", unitsSold: 12, revenue: money(192000), image: { url: "/images/ElizKloset Royal Blue Corporate Dress.png", alt: "Blue corporate dress" } }], recentOrders: Array.from({ length: 5 }, (_, index) => ({ id: `test-order-${index}`, reference: `TEST-${1024 - index}`, customer: { name: `Test customer ${index + 1}` }, total: money([16000, 22000, 32000, 16000, 22000][index]), fulfilmentStatus: ["processing", "delivered", "shipped", "delivered", "awaiting_payment"][index], createdAt: `2026-10-${26 - index}T09:00:00Z` })) };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const listener = net.createServer(); await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve)); const port = listener.address().port; await new Promise((resolve) => listener.close(resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "elizkloset-admin-visual-"));
  const browser = spawn(browserPath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket; let nextId = 0; const pending = new Map(); const apiCalls = []; const errors = []; let empty = false;
  let signedIn = !checkLogin; let loginAttempts = 0;
  function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }
  try {
    let pages;
    for (let attempt = 0; attempt < 80; attempt++) { try { pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (pages.length) break; } catch {} await wait(150); }
    if (!pages?.length) throw new Error("Headless browser did not start.");
    socket = new WebSocket(pages.find((item) => item.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    socket.addEventListener("message", async (event) => {
      const message = JSON.parse(event.data);
      if (message.id) { const request = pending.get(message.id); pending.delete(message.id); if (message.error) request?.reject(new Error(message.error.message)); else request?.resolve(message.result); }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
      if (message.method === "Fetch.requestPaused") {
        const { requestId, request } = message.params; const url = new URL(request.url); apiCalls.push(url.pathname + url.search);
        let body; let responseCode = 200;
        if (url.pathname.endsWith("auth/me")) { body = signedIn ? { data: staff } : { error: { message: "Staff authentication required." } }; responseCode = signedIn ? 200 : 401; }
        else if (checkLogin && url.pathname.endsWith("auth/sign-in")) {
          const fields = JSON.parse(request.postData);
          assert.equal(fields.email, "test@example.com"); assert.equal(fields.password, "test-password");
          loginAttempts++;
          body = loginAttempts === 1 ? { error: { message: "Invalid email or password." } } : { data: { status: "mfa_required", challengeId: "test-challenge-1234567890" } };
          responseCode = loginAttempts === 1 ? 401 : 200;
        }
        else if (checkLogin && url.pathname.endsWith("auth/mfa")) {
          const fields = JSON.parse(request.postData); assert.equal(fields.challengeId, "test-challenge-1234567890");
          if (fields.code === "000000") { responseCode = 401; body = { error: { message: "Incorrect verification code." } }; }
          else { assert.equal(fields.code, "123456"); signedIn = true; body = { data: { status: "authenticated" } }; }
        }
        else if (url.pathname.endsWith("dashboard")) body = { data: empty ? { ...dashboard, stats: { paidRevenue: money(0), paidOrders: 0, orders: 0, catalogStyles: 0, stockAttention: 0 }, sales: [], topProducts: [], recentOrders: [], orderStatuses: [] } : dashboard };
        else { errors.push("Unexpected API request: " + url.pathname); body = { error: { message: "Unexpected test request" } }; responseCode = 500; }
        try {
          await send("Fetch.fulfillRequest", { requestId, responseCode, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
        } catch (error) {
          // A navigation can cancel a request after the browser paused it.
          if (!/invalid\s*interceptionid/i.test(error.message)) errors.push(error.message);
        }
      }
    });
    await send("Page.enable"); await send("Runtime.enable");
    await send("Fetch.enable", { patterns: [{ urlPattern: base + "/api/admin/*", requestStage: "Request" }] });
    const evaluate = async (expression) => { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
    async function until(expression) { for (let attempt = 0; attempt < 140; attempt++) { if (await evaluate(expression)) return; await wait(150); } throw new Error("Timed out: " + expression); }
    async function viewport(width, height, mobile = false) { await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile }); }
    fs.mkdirSync(".admin-checks", { recursive: true });
    async function screenshot(name) { const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); fs.writeFileSync(path.join(".admin-checks", name + ".png"), Buffer.from(image.data, "base64")); }
    if (checkLogin) {
      await viewport(1440, 1000); await send("Page.navigate", { url: base + "/admin/login" });
      await until("!!document.querySelector('.admin-sign-in-form fieldset:not([disabled])')");
      const gaps = await evaluate("(() => { const email = document.querySelector('input[name=email]').closest('label').getBoundingClientRect(); const password = document.querySelector('input[name=password]').closest('label').getBoundingClientRect(); const button = document.querySelector('.admin-sign-in-form button[type=submit]').getBoundingClientRect(); return { fields: password.top - email.bottom, button: button.top - password.bottom }; })()");
      assert.ok(gaps.fields >= 23, "Email and password fields need breathing room");
      assert.ok(gaps.button >= 28, "Sign-in button must be separated from the inputs");
      assert.match(await evaluate("document.querySelector('.admin-login-photo').getAttribute('src')"), /hero-burgundy/);
      await until("document.querySelector('.admin-login-photo')?.naturalWidth > 0");
      await screenshot("login-desktop");
      const fill = "document.querySelector('input[name=email]').value='test@example.com'; document.querySelector('input[name=password]').value='test-password'; document.querySelector('.admin-sign-in-form').requestSubmit()";
      await evaluate(fill); await until("!!document.querySelector('.admin-notice[role=alert]')");
      assert.match(await evaluate("document.querySelector('.admin-notice[role=alert]').textContent"), /confirm your staff access/);
      await screenshot("login-error");
      await evaluate(fill); await until("!!document.querySelector('input[name=code]')");
      assert.equal(await evaluate("location.pathname"), "/admin/login/verify");
      assert.equal(await evaluate("!!document.querySelector('.admin-otp-form input[name=email], .admin-otp-form input[name=password]')"), false);
      await screenshot("otp-desktop");
      await send("Page.reload"); await until("!!document.querySelector('.admin-otp-form input[name=code]')");
      assert.equal(await evaluate("JSON.parse(sessionStorage.getItem('elizkloset-admin-pending-otp')).challengeId"), "test-challenge-1234567890");
      await evaluate("window.originalNow = Date.now; Date.now = () => window.originalNow() + 360000");
      await until("document.querySelector('#admin-otp-help').textContent.includes('has expired')");
      await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Resend OTP').click()");
      await until("!!document.querySelector('input[name=password]')");
      await evaluate("Date.now = window.originalNow; document.querySelector('input[name=password]').value='test-password'; document.querySelector('input[name=password]').form.requestSubmit()");
      await until("document.querySelector('.admin-notice')?.textContent.includes('new verification code')");
      assert.equal(loginAttempts, 3);
      assert.equal(await evaluate("document.querySelector('.admin-otp-form fieldset').disabled"), false);
      assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('Resend OTP in')).disabled"), true);
      await evaluate("document.querySelector('input[name=code]').focus()");
      await send("Input.insertText", { text: "000000" });
      await evaluate("document.querySelector('.admin-otp-form').requestSubmit()");
      await until("!!document.querySelector('.admin-notice[role=alert]')");
      assert.match(await evaluate("document.querySelector('.admin-notice[role=alert]').textContent"), /code could not be verified/);
      assert.equal(await evaluate("location.pathname"), "/admin/login/verify");
      await evaluate("(() => { const data = new DataTransfer(); data.setData('text/plain', '123 456'); document.querySelector('input[name=code]').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })); })()");
      await until("document.querySelector('input[name=code]').value === '123456'");
      await evaluate("document.querySelector('.admin-otp-form').requestSubmit()");
      await until("!!document.querySelector('.admin-sales-report')");
      assert.equal(await evaluate("sessionStorage.getItem('elizkloset-admin-pending-otp')"), null);
      signedIn = false; await viewport(390, 844, true); await send("Page.navigate", { url: base + "/admin/login" });
      await until("!!document.querySelector('.admin-sign-in-form fieldset:not([disabled])')");
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      await screenshot("login-mobile");
      await evaluate(fill); await until("!!document.querySelector('.admin-otp-form')");
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      await screenshot("otp-mobile");
      await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Back to sign in')).click()");
      await until("location.pathname === '/admin/login' && !!document.querySelector('input[name=password]')");
      assert.equal(await evaluate("sessionStorage.getItem('elizkloset-admin-pending-otp')"), null);
      await send("Page.navigate", { url: base + "/admin/login/verify" });
      await until("document.body.innerText.includes('no active verification request')");
      assert.equal(await evaluate("!!document.querySelector('input[name=code]')"), false);
      assert.equal(errors.length, 0, errors.join("; "));
      console.log("Login browser checks passed: dedicated OTP route, refresh recovery, incorrect-code retry, formatted paste, staff verification, restart/cleanup and mobile layout.");
      return;
    }
    await viewport(1360, 980); await send("Page.navigate", { url: base + "/admin" }); await until("!!document.querySelector('.admin-sales-report')"); await wait(450);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true); await screenshot("desktop");
    await evaluate("document.querySelector('.admin-sidebar-collapse').click()"); await wait(300);
    assert.equal(await evaluate("Math.round(document.querySelector('.admin-sidebar').getBoundingClientRect().width)"), 84); await screenshot("collapsed");
    const position = await evaluate("(() => { const b=document.querySelector('.admin-sidebar-collapse').getBoundingClientRect(), s=document.querySelector('.admin-sidebar').getBoundingClientRect(), n=document.querySelector('.admin-sidebar nav a').getBoundingClientRect(); return { center: (b.left+b.right)/2, edge:s.right, bottom:b.bottom, navTop:n.top }; })()");
    assert.ok(Math.abs(position.center-position.edge)<2, 'Toggle should float across the sidebar edge');
    assert.ok(position.bottom < position.navTop, 'Toggle must clear the Overview icon');
    await send("Page.reload"); await until("!!document.querySelector('.admin-sales-report')");
    assert.equal(await evaluate("document.querySelector('.admin-shell').classList.contains('sidebar-collapsed')"), true);
    await evaluate("document.querySelector('.admin-line-chart svg').focus()");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft" });
    assert.ok((await evaluate("document.querySelector('.admin-chart-readout').textContent")).includes("2026-10-25"));
    await evaluate("Array.from(document.querySelectorAll('.admin-range-chips button')).find(button => button.textContent === '7D').click()");
    await until("!!document.querySelector('.admin-sales-report')");
    assert.ok(apiCalls.some((url) => url.includes("createdFrom=") && url.includes("createdTo=")));
    await viewport(390, 844, true); await wait(350);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true); await screenshot("mobile");
    await evaluate("document.querySelector('.admin-mobile-menu').click()"); await wait(250);
    assert.equal(await evaluate("document.querySelector('.admin-sidebar').inert"), false); await screenshot("mobile-navigation");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" }); await wait(250);
    assert.equal(await evaluate("document.querySelector('.admin-sidebar').inert"), true);
    assert.equal(await evaluate("document.activeElement === document.querySelector('.admin-mobile-menu')"), true);
    empty = true; await send("Page.reload"); await until("!!document.querySelector('.admin-dashboard-empty')");
    assert.ok((await evaluate("document.body.innerText")).includes("No orders in this period"));
    assert.doesNotMatch(await evaluate("document.body.innerText"), /\bdemo\b|sample records|Integration pending/i);
    await screenshot("mobile-empty"); assert.equal(errors.length, 0, errors.join("; "));
    console.log("Browser checks passed: desktop/mobile, persistent collapse, Escape/focus, chart keyboard interaction, date-filter requests and API empty states.");
  } finally {
    if (socket?.readyState === WebSocket.OPEN) { try { await send("Browser.close"); } catch {} socket.close(); }
    browser.kill();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
