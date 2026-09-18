import { describe, expect, it } from "vitest";
import { resolverSubmissionId } from "@/lib/registros";

// El folio del pedido lo genera el cliente para que un reintento reuse el
// mismo y el backend lo deduplique (findSubmission_ en Code.gs). Como viene
// de fuera, el servidor solo lo acepta si tiene forma de UUID; cualquier otra
// cosa se descarta y se genera uno nuevo, que es el comportamiento que había
// antes de este cambio.

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("resolverSubmissionId", () => {
  it("respeta el folio del cliente cuando es un UUID", () => {
    const folio = "d7d094aa-965f-40e5-b312-8bec8285ee52";
    expect(resolverSubmissionId(folio)).toBe(folio);
  });

  it("normaliza mayúsculas y espacios", () => {
    expect(
      resolverSubmissionId("  D7D094AA-965F-40E5-B312-8BEC8285EE52 "),
    ).toBe("d7d094aa-965f-40e5-b312-8bec8285ee52");
  });

  it.each([
    ["ausente", undefined],
    ["vacío", ""],
    ["no-string", 42],
    ["texto cualquiera", "borra-la-hoja"],
    ["UUID incompleto", "d7d094aa-965f-40e5-b312"],
    ["con inyección", "d7d094aa-965f-40e5-b312-8bec8285ee52=IMPORTRANGE()"],
  ])("genera uno nuevo si el folio es %s", (_caso, entrada) => {
    const resuelto = resolverSubmissionId(entrada);
    expect(resuelto).toMatch(UUID);
    expect(resuelto).not.toBe(entrada);
  });

  it("dos llamadas sin folio no colisionan", () => {
    expect(resolverSubmissionId("")).not.toBe(resolverSubmissionId(""));
  });
});
