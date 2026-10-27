// Isolated customer-flow checks. All API responses are intercepted fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const base = process.env.STORE_CHECK_URL || "http://localhost:3100";
const delayMs = Number(process.env.STORE_CHECK_DELAY_MS || 0);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const product = { id: "test-product-1", slug: "test-office-dress", name: "API Office Dress", description: "API product description", price: { amount: 16000, currency: "GHS" }, category: { name: "Dresses" }, images: [{ id: "image-1", url: "/images/hero-burgundy.png" }], colors: [{ id: "wine", name: "Burgundy", hex: "#750d27", imageIds: ["image-1"] }], variants: [{ id: "variant-1", colorId: "wine", size: "M", inStock: true }, { id: "variant-2", colorId: "wine", size: "L", inStock: false }], badges: [] };
async function main() {
  const listener = net.createServer(); await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve)); const port = listener.address().port; await new Promise((resolve) => listener.close(resolve));
  const browser = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "eliz-customer-check-"))}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket; let nextId = 0; const pending = new Map(); const calls = []; const errors = []; let signedIn = false; let failProducts = false; let userId = "user-1";
  function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }
  try {
    let pages;
    for (let i = 0; i < 80; i++) { try { pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (pages.length) break; } catch {} await wait(150); }
    socket = new WebSocket(pages.find((item) => item.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
    socket.addEventListener("message", async (event) => {
      const message = JSON.parse(event.data);
      if (message.id) { const p = pending.get(message.id); pending.delete(message.id); if (message.error) p?.reject(Error(message.error.message)); else p?.resolve(message.result); }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
      if (message.method === "Fetch.requestPaused") {
        const { requestId, request } = message.params; const url = new URL(request.url); const key = url.pathname.replace("/api/store/", ""); calls.push({ key, query: url.search, body: request.postData });
        if (delayMs) await wait(delayMs);
        let status = 200; let body = {};
        if (key === "site") body = { data: { features: { contactSubmission: true, newsletterSignup: true } } };
        else if (key === "categories") body = { data: [{ id: "category-1", name: "Dresses", slug: "dresses" }] };
        else if (key === "collections") body = { data: [] };
        else if (key === "products") {
          const empty = url.searchParams.get("q") === "missing";
          body = { data: empty ? [] : url.searchParams.has("cursor") ? [{ ...product, id: "test-product-2", slug: "second-dress", name: "Second API Dress" }] : [product], pagination: { total: empty ? 0 : 2, nextCursor: empty || url.searchParams.has("cursor") || url.searchParams.get("limit") === "50" ? null : "cursor-2", hasMore: !empty && !url.searchParams.has("cursor") && url.searchParams.get("limit") !== "50" }, facets: { sizes: ["M", "L"], colors: [{ id: "wine", name: "Burgundy", hex: "#750d27" }], price: { min: 16000, max: 16000 } } };
          if (failProducts) { status = 500; body = { error: { message: "Test catalog failure" } }; }
        } else if (key.includes("reviews")) body = { data: [] };
        else if (key.startsWith("products/")) body = { data: product };
        else if (key === "auth/me") { status = signedIn ? 200 : 401; body = signedIn ? { id: userId, email: "customer@example.com" } : { error: { message: "Please sign in." } }; }
        else if (key === "auth/profile") { status = signedIn ? 200 : 401; body = signedIn ? { data: { id: userId, email: "customer@example.com", first_name: "Customer", last_name: "Example", phone: "+233200000000" } } : { error: { message: "Please sign in." } }; }
        else if (key === "auth/sign-in") { if (JSON.parse(request.postData).password === "wrong-password") { status = 401; body = { error: { message: "Incorrect username or password" } }; } else { signedIn = true; body = {}; } }
        else if (key === "auth/sign-out") { signedIn = false; body = {}; }
        else if (["contact/messages", "newsletter/subscriptions", "auth/profile", "auth/register", "auth/verify-otp", "auth/verify-phone-otp", "auth/forgot-password", "auth/reset-password", "auth/resend-otp"].includes(key)) body = { data: {} };
        else { errors.push("Unexpected API request " + key); status = 500; }
        try { await send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") }); } catch (error) { if (!/invalid\s*interceptionid/i.test(error.message)) errors.push(error.message); }
      }
    });
    await send("Page.enable"); await send("Runtime.enable"); await send("Fetch.enable", { patterns: [{ urlPattern: base + "/api/*", requestStage: "Request" }] });
    const evaluate = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.text); return r.result.value; };
    async function until(expression) { for (let i = 0; i < 140; i++) { if (await evaluate(expression)) return; await wait(150); } throw Error("Timed out: " + expression + "\n" + await evaluate("document.body.innerText") + "\nCalls: " + JSON.stringify(calls)); }
    async function input(selector, value) { await evaluate(`(() => { const input=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`); }
    async function navigate(route) { await send("Page.navigate", { url: base + route }); await until("document.readyState === 'complete'"); }
    async function screenshot(name) { fs.mkdirSync(".admin-checks", { recursive: true }); const shot = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`.admin-checks/${name}.png`, Buffer.from(shot.data, "base64")); }
    async function openProfile() {
      await evaluate("document.querySelector('[aria-label=\"Your account\"]').click()"); await until("document.querySelector('[role=menu]') !== null");
      assert.equal(await evaluate("document.querySelector('.shopping-dialog[aria-labelledby=shopping-dialog-title]').open"), false);
      await evaluate("Array.from(document.querySelectorAll('[role=menuitem]')).find(b=>b.textContent.includes('Go to profile')).click()");
      await until("document.querySelector('.account-panel input[name=first_name]')?.value === 'Customer'");
      assert.equal(await evaluate("document.querySelector('.account-panel input[name=last_name]').value"), "Example");
      assert.equal(await evaluate("document.querySelector('.account-panel input[name=phone]').value"), "+233200000000");
    }
    async function confirmedLogout() {
      const before = calls.filter((call) => call.key === "auth/sign-out").length;
      await evaluate("document.querySelector('[aria-label=\"Your account\"]').click()"); await until("document.querySelector('[role=menu]') !== null");
      await evaluate("Array.from(document.querySelectorAll('[role=menuitem]')).find(b=>b.textContent.includes('Sign out')).click()"); await until("document.querySelector('.customer-signout-dialog').open");
      assert.equal(calls.filter((call) => call.key === "auth/sign-out").length, before);
      await evaluate("Array.from(document.querySelectorAll('.customer-signout-dialog button')).find(b=>b.textContent==='Stay signed in').click()");
      assert.equal(await evaluate("document.querySelector('.customer-account-button').classList.contains('is-signed-in')"), true);
      await evaluate("document.querySelector('[aria-label=\"Your account\"]').click()"); await until("document.querySelector('[role=menu]') !== null");
      await evaluate("Array.from(document.querySelectorAll('[role=menuitem]')).find(b=>b.textContent.includes('Sign out')).click()");
      await evaluate("Array.from(document.querySelectorAll('.customer-signout-dialog button')).find(b=>b.textContent==='Yes, sign out').click()");
      await until("!document.querySelector('.customer-account-button').classList.contains('is-signed-in')");
    }
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate("/shop");
    if (delayMs) {
      await until("document.querySelector('.ek-skeleton[role=status][aria-busy=true]') !== null");
      assert.equal(await evaluate("document.querySelectorAll('.ek-skeleton button, .ek-skeleton input, .ek-skeleton a').length"), 0);
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.skeleton-shimmer, .ek-skeleton-block')).animationName"), "none");
    }
    await until("document.querySelectorAll('.product-card').length === 1");
    await evaluate("document.querySelector('[aria-label=\"Search products\"]').click()");
    await until("document.querySelector('.search-overlay[open]') !== null && document.activeElement?.name === 'search'");
    assert.equal(await evaluate("document.body.style.overflow"), 'hidden');
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
    await until("document.activeElement?.getAttribute('aria-label') === 'Search products'");
    await evaluate("document.querySelector('[aria-label=\"Search products\"]').click()");
    await input('.search-overlay input', 'office');
    await evaluate("document.querySelector('.search-overlay form').requestSubmit()");
    await until("location.search.includes('search=office') && document.querySelector('.inline-shop-search input')?.value === 'office'");
    await until("document.querySelectorAll('.product-card').length === 1");
    assert.ok(calls.some(call=>call.key==='products' && call.query.includes('q=office')));
    await navigate('/shop'); await until("document.querySelectorAll('.product-card').length === 1");
    await evaluate("document.querySelector('.product-card .save-button').click()");
    await until("document.querySelector('.customer-auth-dialog[open]') !== null");
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Wishlist, 0 items\"]') !== null"), true);
    await evaluate("document.querySelector('.customer-auth-dialog [aria-label=\"Close sign in\"]').click()");
    assert.match(await evaluate("document.querySelector('.product-card').innerText"), /API Office Dress/);
    await evaluate("document.querySelector('.load-more-sentinel')?.remove(); Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Load more').click()");
    await until("document.querySelectorAll('.product-card').length === 2");
    await evaluate("document.querySelector('.photo-button').click()"); await until("document.querySelector('.shopping-dialog[open] .product-detail') !== null");
    assert.equal(await evaluate("location.pathname"), "/shop");
    assert.match(await evaluate("document.querySelector('.shopping-dialog[open]').innerText"), /API product description/);
    await evaluate("document.querySelector('.shopping-dialog[open] .size-options button').click()");
    await until("document.querySelector('.shopping-dialog[open] .size-options button').getAttribute('aria-pressed') === 'true'");
    await evaluate("document.querySelector('.shopping-dialog[open] .add-button').click()");
    await until("document.querySelector('[aria-label=\"Shopping bag, 1 items\"]') !== null");
    await evaluate("document.querySelector('.shopping-dialog[open]').close()");
    await input(".inline-shop-search input", "missing"); await until("document.querySelector('.shop-results .empty-state') !== null");
    assert.equal(await evaluate("document.querySelectorAll('.product-card').length"), 0);
    await navigate("/cart"); await until("document.querySelector('.bag-item-info') !== null");
    assert.match(await evaluate("document.querySelector('.bag-item-info').innerText"), /API Office Dress/);
    await until("document.querySelector('.bag-checkout-button').textContent === 'Sign in to checkout'");
    await evaluate("document.querySelector('.bag-checkout-button').click()");
    await until("document.querySelector('.customer-auth-dialog[open]') !== null");
    assert.equal(await evaluate("document.querySelectorAll('.bag-item-info').length"), 1);
    await evaluate("document.querySelector('.customer-auth-dialog [aria-label=\"Close sign in\"]').click()");
    await evaluate("document.querySelector('[aria-label=\"Your account\"]').click()"); await until("document.querySelector('.account-panel input[name=email]') !== null");
    const help = await evaluate("(() => { const b=Array.from(document.querySelectorAll('.account-help-actions button')); return { labels:b.map(el=>el.textContent), positions:b.map(el=>el.getBoundingClientRect().left) }; })()");
    assert.deepEqual(help.labels, ['Verify an existing account','Forgot password?']); assert.ok(help.positions[1] > help.positions[0]);
    await input(".account-panel input[name=email]", "customer@example.com"); await input(".account-panel input[name=password]", "wrong-password");
    await evaluate("document.querySelector('.shopping-dialog[open]').scrollTop=10000; document.querySelector('.account-panel form').requestSubmit()");
    await until("document.querySelector('.account-panel .form-error-summary')?.textContent.includes('Incorrect username')");
    await until("document.activeElement?.classList.contains('form-error-summary')");
    assert.equal(await evaluate("(() => { const error=document.querySelector('.account-panel .form-error-summary').getBoundingClientRect(), input=document.querySelector('.account-panel input').getBoundingClientRect(), dialog=document.querySelector('.shopping-dialog[open]').getBoundingClientRect(); return error.top < input.top && error.top >= dialog.top && error.bottom <= dialog.bottom; })()"), true);
    await input(".account-panel input[name=email]", "customer@example.com"); await input(".account-panel input[name=password]", "fixture-password");
    await evaluate("document.querySelector('.account-panel form').requestSubmit()");
    await until("document.querySelector('.customer-account-button').classList.contains('is-signed-in')");
    assert.equal(await evaluate("document.querySelector('.shopping-dialog[aria-labelledby=shopping-dialog-title]').open"), false);
    await evaluate("document.querySelector('.customer-account-button').focus(); document.querySelector('.customer-account-button').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))");
    await until("document.activeElement?.getAttribute('role') === 'menuitem'");
    await screenshot("customer-menu-desktop");
    await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"); await until("document.querySelector('[role=menu]') === null");
    assert.equal(await evaluate("document.activeElement.classList.contains('customer-account-button')"), true);
    assert.equal(await evaluate("getComputedStyle(document.getElementById(document.activeElement.getAttribute('aria-describedby'))).visibility"), "visible");
    await evaluate("document.querySelector('.customer-account-button').click()");
    await until("document.querySelector('[role=menu]') !== null");
    assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('[role=menuitem]')).map(b=>b.textContent.trim())"), ["Go to profile", "Orders", "Sign out"]);
    await evaluate("Array.from(document.querySelectorAll('[role=menuitem]')).find(b=>b.textContent.trim()==='Orders').click()");
    await until("location.pathname === '/orders' && document.querySelector('.customer-orders-state h2')?.textContent === 'Order history is not available yet.'");
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.related-products')).filter(el=>el.checkVisibility()).length"), 0);
    await navigate('/cart'); await until("document.querySelector('.customer-account-button.is-signed-in') !== null && document.querySelector('.bag-checkout-button') !== null");
    await openProfile();
    await screenshot("customer-profile-prefilled");
    assert.match(await evaluate("document.querySelector('.customer-account-name').textContent"), /Hi, Customer/);
    await evaluate("document.querySelector('.account-panel form').requestSubmit()");
    await until("document.querySelector('.customer-account-notice')?.textContent.includes('Your profile was saved.')");
    assert.equal(await evaluate("document.querySelector('.shopping-dialog[aria-labelledby=shopping-dialog-title]').open"), false);
    assert.equal(await evaluate("document.querySelector('.bag-checkout-button').disabled"), true);
    await confirmedLogout();
    await evaluate("document.querySelector('[aria-label=\"Your account\"]').click()"); await until("document.querySelector('.account-panel input[name=password]') !== null");
    await evaluate("Array.from(document.querySelectorAll('.account-tabs button')).find(b=>b.textContent==='Create account').click()");
    await evaluate("document.querySelector('.account-panel form').requestSubmit()");
    await until("document.activeElement?.name === 'first_name'");
    await input(".account-panel input[name=first_name]", "New"); await input(".account-panel input[name=last_name]", "Customer"); await input(".account-panel input[name=phone]", "+233200000000");
    await input(".account-panel input[name=email]", "new@example.com"); await input(".account-panel input[name=password]", "fixture-password"); await input(".account-panel input[name=confirmPassword]", "fixture-password");
    await input(".account-panel input[name=confirmPassword]", "different-password");
    await evaluate("document.querySelector('.account-panel form').requestSubmit()");
    await until("document.querySelector('.account-panel .form-error-summary')?.textContent === 'Your passwords do not match.' && document.activeElement?.name === 'confirmPassword'");
    await input(".account-panel input[name=confirmPassword]", "fixture-password");
    await evaluate("document.querySelector('.account-panel form').requestSubmit()"); await until("document.querySelector('.account-panel input[name=code]') !== null");
    await input(".account-panel input[name=code]", "012345"); await evaluate("document.querySelector('.account-panel form').requestSubmit()"); await until("document.querySelector('.account-panel').innerText.includes('Account verified')");
    assert.equal(JSON.parse(calls.find((call) => call.key === "auth/verify-otp").body).code, "012345");
    await evaluate("Array.from(document.querySelectorAll('.account-panel button')).find(b=>b.textContent==='Forgot password?').click()");
    await input(".account-panel input[name=email]", "new@example.com"); await evaluate("document.querySelector('.account-panel form').requestSubmit()"); await until("document.querySelector('.account-panel input[name=code]') !== null");
    await input(".account-panel input[name=code]", "012345"); await input(".account-panel input[name=password]", "new-fixture-password"); await evaluate("document.querySelector('.account-panel form').requestSubmit()"); await until("document.querySelector('.account-panel').innerText.includes('Password reset.')");
    await evaluate("Array.from(document.querySelectorAll('.account-tabs button')).find(b=>b.textContent==='Create account').click()");
    assert.equal(await evaluate("document.querySelector('.account-panel input[name=email]').required"), false);
    assert.equal(await evaluate("['first_name','last_name','phone','password','confirmPassword'].every(name=>document.querySelector('.account-panel input[name='+name+']').required)"), true);
    assert.equal(await evaluate("document.querySelectorAll('.account-panel .required-mark').length"), 5);
    await input(".account-panel input[name=first_name]", "Phone"); await input(".account-panel input[name=last_name]", "Customer"); await input(".account-panel input[name=phone]", "+233200000001");
    await input(".account-panel input[name=password]", "fixture-password"); await input(".account-panel input[name=confirmPassword]", "fixture-password"); await evaluate("document.querySelector('.account-panel form').requestSubmit()"); await until("document.querySelector('.account-panel input[name=code]') !== null");
    const registration = JSON.parse(calls.filter((call) => call.key === "auth/register").at(-1).body);
    assert.equal(Object.hasOwn(registration, "email"), false); assert.equal(registration.phone, "+233200000001");
    await input(".account-panel input[name=code]", "012345"); await evaluate("document.querySelector('.account-panel form').requestSubmit()"); await until("document.querySelector('.account-panel').innerText.includes('Account verified')");
    assert.equal(JSON.parse(calls.find((call) => call.key === "auth/verify-phone-otp").body).target, "+233200000001");
    await navigate("/products/test-office-dress"); await until("document.querySelector('.commerce-page .product-detail') !== null");
    assert.match(await evaluate("document.querySelector('.commerce-page .product-detail').innerText"), /API product description/);
    await navigate("/contact"); await until("document.querySelector('.contact-email-form button').disabled === false");
    await input(".contact-email-form input[name=name]", "Customer"); await input(".contact-email-form input[name=email]", "customer@example.com");
    await evaluate("document.querySelector('.contact-email-form textarea').value='A test enquiry'; document.querySelector('.contact-email-form').requestSubmit()"); await until("document.body.innerText.includes('Your message was sent')");
    assert.equal(JSON.parse(calls.find((call) => call.key === "contact/messages").body).subject, "product_enquiry");
    await navigate("/"); await until("document.querySelector('#newsletter-email')?.disabled === false");
    await input("#newsletter-email", "customer@example.com"); await evaluate("document.querySelector('.newsletter form').requestSubmit()"); await until("document.body.innerText.includes('subscription request was accepted')");
    await navigate("/shop"); await until("document.querySelector('.product-card .save-button') !== null");
    await evaluate("document.querySelector('.product-card .save-button').click()"); await until("document.querySelector('.customer-auth-dialog[open] input[name=password]') !== null");
    await input(".customer-auth-dialog input[name=email]", "customer@example.com"); await input(".customer-auth-dialog input[name=password]", "fixture-password"); await evaluate("document.querySelector('.customer-auth-dialog form').requestSubmit()");
    await until("document.querySelector('[aria-label=\"Wishlist, 1 items\"]') !== null");
    assert.equal(await evaluate("document.querySelector('.customer-auth-dialog').open"), false);
    await navigate("/wishlist"); await until("document.querySelector('.wishlist-card') !== null");
    await confirmedLogout(); await until("document.querySelector('[aria-label=\"Wishlist, 0 items\"]') !== null");
    assert.equal(await evaluate("document.querySelector('.customer-account-button').classList.contains('is-signed-in')"), false);
    assert.equal(await evaluate("document.querySelectorAll('.wishlist-card').length"), 0);
    userId = "user-2";
    await evaluate("document.querySelector('[aria-label=\"Your account\"]').click()"); await until("document.querySelector('.account-panel input[name=password]') !== null");
    await input(".account-panel input[name=email]", "other@example.com"); await input(".account-panel input[name=password]", "fixture-password"); await evaluate("document.querySelector('.account-panel form').requestSubmit()"); await until("document.querySelector('.customer-account-button').classList.contains('is-signed-in')");
    assert.equal(await evaluate("document.querySelectorAll('.wishlist-card').length"), 0);
    await navigate("/shop"); await until("document.querySelector('.product-card .save-button') !== null");
    signedIn = false;
    await evaluate("document.querySelector('.product-card .save-button').click()"); await until("document.querySelector('.customer-auth-dialog[open]') !== null");
    assert.equal(await evaluate("localStorage.getItem('elizkloset-wishlist-v1:user-2')"), null);
    await evaluate("document.querySelector('.customer-auth-dialog [aria-label=\"Close sign in\"]').click()");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await navigate("/shop"); await until("document.querySelector('.product-card') !== null");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true);
    fs.mkdirSync(".admin-checks", { recursive: true }); const shot = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(".admin-checks/store-mobile.png", Buffer.from(shot.data, "base64"));
    signedIn = true; await navigate("/shop"); await until("document.querySelector('.customer-account-button').classList.contains('is-signed-in')");
    await evaluate("document.querySelector('.customer-account-button').click()"); await until("document.querySelector('[role=menu]') !== null");
    assert.equal(await evaluate("(() => {const r=document.querySelector('[role=menu]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()"), true);
    await screenshot("customer-menu-mobile"); await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    failProducts = true; await navigate("/shop"); await until("document.querySelector('.error-toast[role=alert]') !== null");
    assert.equal(await evaluate("document.querySelectorAll('.product-card').length"), 0);
    assert.equal(await evaluate("document.querySelectorAll('.error-toast').length"), 1);
    assert.equal(await evaluate("document.querySelectorAll('main [role=alert]').length"), 0);
    assert.equal(await evaluate("(() => { const r=document.querySelector('.error-toast').getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight; })()"), true);
    await screenshot('store-error-toast-mobile');
    failProducts = false;
    await evaluate("document.querySelector('.error-toast-retry').click()");
    await until("document.querySelector('.error-toast') === null && document.querySelectorAll('.product-card').length === 1");
    failProducts = true; await navigate('/shop'); await until("document.querySelector('.error-toast') !== null");
    await evaluate("document.querySelector('.error-toast-close').click()"); await until("document.querySelector('.error-toast') === null");
    assert.equal(errors.length, 0, errors.join("; "));
    signedIn = false; await navigate('/orders');
    await until("document.querySelector('.customer-orders-state button')?.textContent === 'Sign in to view orders'");
    await evaluate("document.querySelector('.customer-orders-state button').click()");
    await until("document.querySelector('.customer-auth-dialog[open]') !== null");
    console.log("Customer browser checks passed: orders navigation and guest gate, profile menu, full prefilled details, save/close, confirmed sign-out/cancellation, catalog, OTP/reset, guest gates, account isolation and mobile layout. No live writes performed.");
  } finally { if (socket?.readyState === WebSocket.OPEN) { try { await send("Browser.close"); } catch {} socket.close(); } browser.kill(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
