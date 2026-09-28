const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");

const { NAV, MODULES, filterNav, countByInterest } = load("lib/nav.ts");
const { INTERESTS, INTEREST_BY_ID } = load("lib/interests.ts");

test("el registro de navegación no tiene rutas ni códigos repetidos", () => {
  const hrefs = MODULES.map((m) => m.href);
  const codes = MODULES.map((m) => m.code);
  assert.equal(new Set(hrefs).size, hrefs.length, "rutas duplicadas");
  assert.equal(new Set(codes).size, codes.length, "códigos duplicados");
  for (const code of codes) {
    assert.ok(code.length <= 3, `${code} no entra en el riel contraído`);
  }
});

test("todo módulo declara a quién le sirve, con perfiles que existen", () => {
  for (const item of MODULES) {
    assert.ok(item.interests.length >= 1, `${item.href} sin perfil`);
    assert.equal(new Set(item.interests).size, item.interests.length, `${item.href} repite un perfil`);
    for (const id of item.interests) {
      assert.ok(INTEREST_BY_ID.has(id), `${item.href} usa un perfil inexistente: ${id}`);
    }
  }
});

test("ningún perfil queda vacío: todos tienen al menos tres módulos", () => {
  for (const interest of INTERESTS) {
    const n = countByInterest(interest.id);
    assert.ok(n >= 3, `${interest.label} solo tiene ${n} módulo(s)`);
  }
});

test("el filtro suma perfiles en vez de cruzarlos", () => {
  const todo = filterNav([]);
  assert.deepEqual(todo, NAV, "sin filtro se ve el terminal completo");

  const riesgo = filterNav(["riesgo"]).flatMap((g) => g.items);
  assert.ok(riesgo.every((item) => item.interests.includes("riesgo")));
  assert.ok(riesgo.some((item) => item.href === "/seguridad"), "Exploits es un módulo de riesgo");

  const dos = filterNav(["riesgo", "cumplimiento"]).flatMap((g) => g.items);
  assert.ok(dos.length > riesgo.length, "marcar dos perfiles suma módulos, no los cruza");

  // los grupos que quedan sin módulos no se dibujan
  assert.ok(filterNav(["cumplimiento"]).every((g) => g.items.length > 0));
});

test("cada perfil declara su audiencia, su pregunta y la unidad de negocio que lo usa", () => {
  for (const interest of INTERESTS) {
    for (const campo of ["label", "short", "audience", "question", "unit"]) {
      assert.ok(interest[campo]?.length > 2, `${interest.id} sin ${campo}`);
    }
    // las fichas del filtro no pueden repetir un código de módulo
    assert.ok(!MODULES.some((m) => m.code === interest.short), `${interest.short} choca con un módulo`);
  }
});
