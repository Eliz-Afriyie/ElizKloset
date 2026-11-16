// Public fixtures are captured from live read-only calls before browser rendering.
// Every browser API request is intercepted; no backend writes are performed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { spawn } = require("node:child_process");
const base = process.env.CONTENT_CHECK_URL || "http://localhost:3000";
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const imageUrl = "https://storage.googleapis.com/developers-bucket/side/kaftan.jpg";
async function main() {
  const publicData = {};
  for (const resource of ["site", "pages/home", "pages/shop", "pages/about", "pages/contact", "products", "categories", "collections", "reviews"]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(base + "/api/store/" + resource + (resource === "products" ? "?limit=50&sort=newest" : ""));
      if (response.ok) { publicData[resource] = await response.json(); break; }
      if (response.status < 500 || attempt === 2) throw Error(`Live content preflight failed: ${resource} (${response.status})`);
    }
  }
  const listener = net.createServer(); await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve)); const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  const browser = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "eliz-content-"))}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket; let nextId = 0; const pending = new Map(); const errors = []; const calls = [];
  function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }
  try {
    let pages;
    for (let i = 0; i < 80; i++) { try { pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (pages.length) break; } catch {} await wait(150); }
    if (!pages?.length) throw Error("Browser did not start");
    socket = new WebSocket(pages.find(item => item.type === "page").webSocketDebuggerUrl); await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
    socket.addEventListener("message", async event => {
      const message = JSON.parse(event.data);
      if (message.id) { const p = pending.get(message.id); pending.delete(message.id); if (message.error) p?.reject(Error(message.error.message)); else p?.resolve(message.result); }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
      if (message.method === "Fetch.requestPaused") {
        const { requestId, request } = message.params; const pathname = new URL(request.url).pathname; const key = pathname.replace("/api/admin/", ""); calls.push({ key, method: request.method, body: request.postData });
        let body; let status = 200;
        if (pathname.startsWith("/api/store/")) { const resource = pathname.replace("/api/store/", ""); body = publicData[resource]; if (!body) { status = resource === "auth/me" ? 401 : 404; body = { error: { message: "Not available" } }; } }
        else if (key === "auth/me") body = { data: { id: "test-staff", name: "Test staff", email: "test@example.com", role: "owner", permissions: ["catalog:read", "catalog:write", "content:read", "content:write"] } };
        else if (key === "gallery") body = request.method === "POST" ? { data: { id: "new", gallery_url: JSON.parse(request.postData).gallery_url } } : { data: [{ id: "gallery-1", gallery_url: imageUrl }] };
        else if (key === "categories" || key === "collections") body = { data: key === "categories" ? [{ id: "c1", name: "Test category", slug: "test", description: "", status: "active", version: 1, assignedProductCount: 0, image_url: imageUrl }] : [], pagination: { page: 1, pageSize: 8, total: key === "categories" ? 1 : 0, totalPages: 1 } };
        else if (key === "products") body = { data: [], pagination: { page: 1, pageSize: 8, total: 0, totalPages: 0 }, summary: { all: 0, outOfStock: 0, lowStock: 0 } };
        else { status = 500; body = { error: { message: "Unexpected intercepted admin endpoint" } }; errors.push(key); }
        try { await send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") }); } catch (error) { if (!/interception/i.test(error.message)) errors.push(error.message); }
      }
    });
    await send("Page.enable"); await send("Runtime.enable"); await send("Fetch.enable", { patterns: [{ urlPattern: base + "/api/*", requestStage: "Request" }] });
    const evaluate = async expression => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.text); return r.result.value; };
    async function until(expression) { for (let i = 0; i < 240; i++) { if (await evaluate(expression)) return; await wait(250); } throw Error("Timed out: " + expression + "\n" + await evaluate("document.body.innerText")); }
    async function navigate(route) { await send("Page.navigate", { url: base + route }); }
    async function clickText(text) { await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(text)}).click()`); }
    async function screenshot(name) { fs.mkdirSync(".admin-checks", { recursive: true }); const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(".admin-checks", name + ".png"), Buffer.from(r.data, "base64")); }
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate("/"); await until("document.querySelectorAll('.carousel-slide').length > 0 && document.querySelector('.footer-brand img') !== null");
    assert.equal(await evaluate("document.querySelector('.hero-heading').textContent"), "Dress Corporate with Liz");
    assert.equal(await evaluate("document.querySelector('.hero-portrait img').getAttribute('src').startsWith('https://storage.googleapis.com/')"), true);
    assert.equal(await evaluate("document.querySelectorAll('.service-strip > div').length"), 4);
    assert.equal(await evaluate("document.querySelector('#newsletter-email').disabled"), true);
    await until("document.querySelector('.hero-portrait img').complete && document.querySelector('.hero-portrait img').naturalWidth > 0"); await screenshot("api-content-home");
    await evaluate("document.querySelector('footer').scrollIntoView()"); await wait(300); await screenshot("api-content-footer");
    for (const route of ["/shop", "/collections", "/about", "/contact"]) {
      await navigate(route); await until("document.querySelector('main h1') !== null && document.querySelector('.footer-brand img') !== null");
      assert.ok(await evaluate("document.querySelector('main h1').textContent.trim().length > 0"));
      if (route === "/contact") { await until("document.querySelector('.contact-email-form') !== null"); assert.equal(await evaluate("document.querySelector('.contact-email-form button').disabled"), true); }
    }
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await navigate("/"); await until("document.querySelector('.hero-heading') !== null");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    assert.equal(await evaluate("document.querySelector('.hero-heading').getBoundingClientRect().right <= document.querySelector('.hero-content').getBoundingClientRect().right + 1"), true); await screenshot("api-content-mobile");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate("/admin/gallery"); await until("document.querySelectorAll('.gallery-tile').length === 1");
    assert.equal(await evaluate("document.querySelector('a[href=\"/admin/gallery\"]').textContent"), "Gallery");
    await navigate("/admin/products/new"); await until("document.querySelector('.admin-wizard-form') !== null"); await clickText("Select from gallery"); await until("document.querySelector('.gallery-tile') !== null");
    await evaluate("document.querySelector('.gallery-tile').click()"); await clickText("Use this image");
    await until("document.querySelector('.admin-image-preview img')?.getAttribute('src') === " + JSON.stringify(imageUrl));
    assert.equal(calls.filter(call => call.method === "POST").length, 0); await screenshot("gallery-product-picker");
    await navigate("/admin/collections"); await until("document.querySelector('.admin-card-heading') !== null"); await clickText("Add category"); await clickText("Select from gallery"); await until("document.querySelector('.gallery-tile') !== null");
    await evaluate("document.querySelector('.gallery-tile').click()"); await clickText("Use this image");
    await until("document.querySelector('dialog[open] img[alt=\"Selected image\"]')?.getAttribute('src') === " + JSON.stringify(imageUrl));
    await screenshot("gallery-category-picker");
    await navigate("/admin/gallery"); await until("document.querySelector('.gallery-url input') !== null");
    await evaluate(`(() => { const input = document.querySelector('.gallery-url input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(imageUrl)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await clickText("Add URL to gallery"); await until("document.body.innerText.includes('Added to gallery')");
    const registration = calls.find(call => call.key === "gallery" && call.method === "POST");
    assert.equal(JSON.parse(registration.body).gallery_url, imageUrl);
    assert.equal(errors.length, 0, errors.join("; "));
    console.log("Browser checks passed: live-content hero/footer, shop/collections/about/contact, mobile title bounds, fixture gallery registration and product/category pickers. No live writes.");
  } finally { if (socket?.readyState === WebSocket.OPEN) { try { await send("Browser.close"); } catch {} socket.close(); } browser.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
