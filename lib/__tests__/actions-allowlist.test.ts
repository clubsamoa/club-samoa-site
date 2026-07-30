import { describe, expect, it } from "vitest";
import {
  CACHEABLE_ACTIONS,
  READ_ACTIONS,
  WRITE_ACTIONS,
  isCacheableAction,
  isKnownAction,
  isReadAction,
  isWriteAction,
} from "@/lib/actions-allowlist";

// Las 27 acciones del switch de Eventos.gs:264-340, transcritas de forma
// independiente a la allowlist para que este test detecte una omisión.
const ACTIONS_EN_BACKEND = [
  "ping",
  "atletas.list",
  "atletas.get",
  "atletas.create",
  "atletas.update",
  "atletas.archive",
  "atletas.delete",
  "eventos.list",
  "eventos.get",
  "eventos.create",
  "eventos.update",
  "eventos.setestatus",
  "eventos.delete",
  "inscripciones.list",
  "inscripciones.create",
  "inscripciones.setpesopesaje",
  "inscripciones.setestatus",
  "inscripciones.setcategoria",
  "inscripciones.clearcategoria",
  "inscripciones.delete",
  "brackets.confirm",
  "brackets.list",
  "brackets.get",
  "brackets.listfull",
  "brackets.delete",
  "peleas.update",
  "peleas.get",
  "peleas.next",
  "peleas.finalize",
];

describe("cobertura de la allowlist", () => {
  it("cubre todas las acciones del backend excepto 'setup'", () => {
    const faltantes = ACTIONS_EN_BACKEND.filter((a) => !isKnownAction(a));
    expect(faltantes).toEqual([]);
  });

  it("excluye 'setup' (mantenimiento destructivo de la Sheet)", () => {
    expect(isKnownAction("setup")).toBe(false);
  });

  it("no clasifica una acción como lectura y escritura a la vez", () => {
    const ambas = [...READ_ACTIONS].filter((a) =>
      (WRITE_ACTIONS as readonly string[]).includes(a),
    );
    expect(ambas).toEqual([]);
  });

  it("las cacheables son un subconjunto de las lecturas", () => {
    for (const action of CACHEABLE_ACTIONS) {
      expect(isReadAction(action)).toBe(true);
    }
  });

  it("ninguna escritura es cacheable", () => {
    for (const action of WRITE_ACTIONS) {
      expect(isCacheableAction(action)).toBe(false);
    }
  });
});

describe("clasificación", () => {
  it("las mutaciones son escrituras", () => {
    for (const action of [
      "atletas.create",
      "atletas.delete",
      "eventos.setestatus",
      "inscripciones.setpesopesaje",
      "brackets.confirm",
      "peleas.finalize",
    ]) {
      expect(isWriteAction(action)).toBe(true);
      expect(isReadAction(action)).toBe(false);
    }
  });

  it("las consultas son lecturas", () => {
    for (const action of ["atletas.list", "brackets.get", "peleas.next"]) {
      expect(isReadAction(action)).toBe(true);
      expect(isWriteAction(action)).toBe(false);
    }
  });

  it("rechaza acciones inventadas y intentos de path traversal", () => {
    for (const action of [
      "atletas.foo",
      "atletas",
      "",
      "../setup",
      "atletas.list?x=1",
      "ATLETAS.LIST",
    ]) {
      expect(isKnownAction(action)).toBe(false);
    }
  });
});
