const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const modules = new Map();

// Carga módulos puros TS con los aliases del proyecto; sin instalar un runner.
module.exports = function loadTs(relative) {
  const filename = path.resolve(root, relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const mod = { exports: {} };
  modules.set(filename, mod);
  const nativeRequire = createRequire(filename);
  const localRequire = name => {
    const target = name.startsWith("@/") ? path.resolve(root, name.slice(2)) : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
    if (target && fs.existsSync(target + ".ts")) return loadTs(target + ".ts");
    return nativeRequire(name);
  };
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  new Function("require", "module", "exports", output)(localRequire, mod, mod.exports);
  return mod.exports;
};
