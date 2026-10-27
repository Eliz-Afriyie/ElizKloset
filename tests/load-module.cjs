const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

module.exports = function loadModule(entry, overrides = {}, globals = {}) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (overrides[filename]) return overrides[filename];
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = { exports: {} }; cache.set(filename, compiledModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(source, {
      module: compiledModule, exports: compiledModule.exports,
      require: (name) => {
        if (overrides[name]) return overrides[name];
        if (!name.startsWith(".")) return require(name);
        const candidate = path.resolve(path.dirname(filename), name);
        const resolved = [candidate + ".ts", candidate + ".tsx", candidate].find((file) => fs.existsSync(file));
        if (!resolved) throw new Error("Cannot resolve " + candidate);
        return load(resolved);
      },
      fetch: (...args) => globalThis.fetch(...args), process: { env: { NODE_ENV: "production" } },
      Headers, Response, Request, URL, URLSearchParams, FormData, Blob, AbortSignal, Event,
      structuredClone, crypto, setTimeout, clearTimeout,
      window: { dispatchEvent() {}, confirm() { return true; } },
      ...globals,
    }, { filename });
    return compiledModule.exports;
  }
  return load(entry);
};
