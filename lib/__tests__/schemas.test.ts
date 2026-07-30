import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AtletaSchema,
  BracketSchema,
  EventoSchema,
  InscripcionSchema,
  PeleaSchema,
  parseOrWarn,
} from "@/lib/schemas";

// Fixtures con la forma exacta que produce normalizeOutput_ (Eventos.gs):
// strings vacíos para celdas vacías, null para números vacíos, false para
// booleanos vacíos, fechas "yyyy-MM-dd".

const atleta = {
  id: "atl_001",
  nombre_completo: "José Ángel Pérez",
  fecha_nacimiento: "2010-04-12",
  genero: "Masculino",
  anios_practica: 3,
  nivel: "Intermedio",
  peso_referencia_kg: 42.5,
  academia: "Club Samoa",
  pais: "México",
  foto_url: "",
  activo: true,
  creado_en: "2026-05-01 10:00",
};

const evento = {
  id: "evt_001",
  nombre: "Copa Samoa 2026",
  fecha: "2026-08-15",
  sede: "Ciudad Madero",
  estatus: "activo",
  creado_en: "2026-05-01 10:00",
};

const inscripcion = {
  id: "ins_001",
  evento_id: "evt_001",
  atleta_id: "atl_001",
  peso_pesaje_kg: null, // aún sin pesaje
  categoria_calculada: "",
  estatus: "pendiente_pesaje",
  creado_en: "2026-05-02 09:00",
  categoria_override: false,
};

const bracket = {
  id: "brk_001",
  evento_id: "evt_001",
  categoria: "Juvenil A -45kg Masculino",
  tipo_bracket: "eliminacion_simple",
  num_atletas: 4,
  estatus: "confirmado",
  json_estructura: '{"rondas":[]}',
  creado_en: "2026-05-03 12:00",
};

const pelea = {
  id: "pel_001",
  bracket_id: "brk_001",
  ronda: "Semifinal",
  numero_pelea: 1,
  atleta1_id: "atl_001",
  atleta2_id: "atl_002",
  ganador_id: "",
  metodo_finalizacion: "",
  round_finalizacion: null,
  tiempo_finalizacion: "",
  notas: "",
  actualizado_en: "2026-05-03 12:00",
  ronda_idx: 0,
  numero_en_ronda: 1,
  bye: false,
  auto_ganador_id: "",
  pelea_anterior_1: null,
  pelea_anterior_2: null,
};

afterEach(() => vi.restoreAllMocks());

describe("esquemas del dominio", () => {
  it("valida las 5 entidades con fixtures del backend", () => {
    expect(AtletaSchema.parse(atleta)).toEqual(atleta);
    expect(EventoSchema.parse(evento)).toEqual(evento);
    expect(InscripcionSchema.parse(inscripcion)).toEqual(inscripcion);
    expect(BracketSchema.parse(bracket)).toEqual(bracket);
    expect(PeleaSchema.parse(pelea)).toEqual(pelea);
  });

  it("normaliza '' a null en campos numéricos (rutas viejas del backend)", () => {
    const parsed = InscripcionSchema.parse({
      ...inscripcion,
      peso_pesaje_kg: "",
    });
    expect(parsed.peso_pesaje_kg).toBeNull();
  });

  it("rechaza un estatus fuera del enum", () => {
    expect(() =>
      EventoSchema.parse({ ...evento, estatus: "cancelado" }),
    ).toThrow();
  });

  it("rechaza un género fuera del enum", () => {
    expect(() => AtletaSchema.parse({ ...atleta, genero: "X" })).toThrow();
  });
});

describe("parseOrWarn", () => {
  it("devuelve los datos validados en camino feliz", () => {
    expect(parseOrWarn(EventoSchema, evento, "eventos.get")).toEqual(evento);
  });

  it("en desarrollo lanza con el contexto y el campo", () => {
    expect(() =>
      parseOrWarn(EventoSchema, { ...evento, estatus: "x" }, "eventos.get"),
    ).toThrow(/eventos\.get[\s\S]*estatus/);
  });

  it("en producción loggea y degrada sin lanzar", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const data = { ...evento, estatus: "x" };
    expect(parseOrWarn(EventoSchema, data, "eventos.get")).toEqual(data);
    expect(spy).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
  });
});
