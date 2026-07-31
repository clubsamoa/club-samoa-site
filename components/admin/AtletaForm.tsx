"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useToast } from "@/components/admin/Toaster";
import { ApiError, api } from "@/lib/api-client";
import {
  GENEROS,
  NIVELES,
  calcularCategoriaPeso,
  calcularDivisionEdad,
  sugerirNivel,
} from "@/lib/reglamento";
import type { Atleta } from "@/lib/schemas";

// Puerto de legacy/admin/js/atletas-form.js (470 líneas): modal de alta y
// edición. Conserva la sugerencia automática de nivel a partir de los años de
// práctica y las mismas reglas de validación (validate_, atletas-form.js:341).
// Añade el cálculo en vivo de división y categoría de peso, que el original
// no mostraba.

const AtletaFormSchema = z.object({
  nombre_completo: z.string().trim().min(1, "Requerido"),
  fecha_nacimiento: z
    .string()
    .min(1, "Requerido")
    .refine((v) => !isNaN(new Date(v).getTime()), "Fecha inválida")
    .refine((v) => new Date(v) <= new Date(), "No puede ser futura")
    .refine((v) => new Date(v).getFullYear() >= 1900, "Año demasiado antiguo"),
  genero: z.enum(GENEROS, "Requerido"),
  anios_practica: z.coerce.number("Requerido").min(0, "Debe ser ≥ 0"),
  nivel: z.enum(NIVELES, "Requerido"),
  peso_referencia_kg: z.coerce.number("Requerido").gt(0, "Debe ser > 0"),
  academia: z.string().trim().optional(),
  pais: z.string().trim().optional(),
  foto_url: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || /^https?:\/\//.test(v),
      "URL inválida (usa http:// o https://)",
    ),
});

type Campo = keyof z.infer<typeof AtletaFormSchema>;

export default function AtletaForm({
  atleta,
  onClose,
}: {
  atleta: Atleta | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toastError, toastSuccess } = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primerCampoRef = useRef<HTMLInputElement>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);

  const esEdicion = atleta !== null;

  const [valores, setValores] = useState({
    nombre_completo: atleta?.nombre_completo ?? "",
    fecha_nacimiento: atleta?.fecha_nacimiento ?? "",
    genero: atleta?.genero ?? "",
    anios_practica:
      atleta?.anios_practica != null ? String(atleta.anios_practica) : "",
    nivel: atleta?.nivel ?? "",
    peso_referencia_kg:
      atleta?.peso_referencia_kg != null
        ? String(atleta.peso_referencia_kg)
        : "",
    academia: atleta?.academia ?? "",
    pais: atleta?.pais || "México",
    foto_url: atleta?.foto_url ?? "",
  });
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [errorBanner, setErrorBanner] = useState("");
  // El nivel deja de auto-sugerirse en cuanto el operador lo elige a mano.
  const [nivelTocado, setNivelTocado] = useState(esEdicion);

  const set = (campo: string, valor: string) =>
    setValores((prev) => ({ ...prev, [campo]: valor }));

  // Foco inicial y restauración al cerrar (el original solo hacía lo primero).
  useEffect(() => {
    disparadorRef.current = document.activeElement as HTMLElement | null;
    primerCampoRef.current?.focus();
    return () => disparadorRef.current?.focus?.();
  }, []);

  // Escape cierra; Tab queda atrapado dentro del modal.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const foco = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!foco || foco.length === 0) return;
      const primero = foco[0]!;
      const ultimo = foco[foco.length - 1]!;
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Sugerencia de nivel al escribir los años de práctica. Como en el original
  // (atletas-form.js:120-130) se hace en el propio evento de input, no en un
  // efecto: así no hay render en cascada.
  const onAniosChange = (valor: string) => {
    setValores((prev) => {
      const siguiente = { ...prev, anios_practica: valor };
      if (!nivelTocado && valor !== "") {
        const sugerido = sugerirNivel(parseFloat(valor));
        if (sugerido) siguiente.nivel = sugerido;
      }
      return siguiente;
    });
  };

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      esEdicion
        ? api.post("atletas.update", { id: atleta.id, ...payload })
        : api.post("atletas.create", payload),
    onSuccess: () => {
      toastSuccess(esEdicion ? "Atleta actualizado." : "Atleta creado.");
      void queryClient.invalidateQueries({ queryKey: ["atletas.list"] });
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? e.message : "No se pudo guardar.";
      setErrorBanner(msg);
      toastError(msg);
    },
  });

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorBanner("");
    const parsed = AtletaFormSchema.safeParse(valores);
    if (!parsed.success) {
      const nuevos: Partial<Record<Campo, string>> = {};
      for (const issue of parsed.error.issues) {
        const campo = issue.path[0] as Campo | undefined;
        if (campo && !nuevos[campo]) nuevos[campo] = issue.message;
      }
      setErrores(nuevos);
      const primerCampo = Object.keys(nuevos)[0];
      if (primerCampo) {
        dialogRef.current
          ?.querySelector<HTMLElement>(`[name="${primerCampo}"]`)
          ?.focus();
      }
      return;
    }
    setErrores({});
    guardar.mutate(parsed.data);
  };

  // Vista previa: división por edad y categoría de peso (cálculo en vivo).
  const hoy = new Date().toISOString().slice(0, 10);
  const division = valores.fecha_nacimiento
    ? calcularDivisionEdad(valores.fecha_nacimiento, hoy)
    : "";
  const categoria =
    division && valores.genero && valores.peso_referencia_kg
      ? calcularCategoriaPeso(
          division,
          valores.genero,
          parseFloat(valores.peso_referencia_kg),
        )
      : null;

  const campoError = (campo: Campo) =>
    errores[campo] ? (
      <span className="form-error" role="alert">
        {errores[campo]}
      </span>
    ) : null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atleta-form-title"
        ref={dialogRef}
      >
        <div className="modal-header">
          <h2 id="atleta-form-title">
            {esEdicion ? "Editar atleta" : "Nuevo atleta"}
          </h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {errorBanner && (
          <div className="modal-error" role="alert">
            {errorBanner}
          </div>
        )}

        <form className="modal-form" onSubmit={onSubmit} noValidate>
          <div className="form-grid">
            <label className="form-field">
              <span className="form-label">Nombre completo *</span>
              <input
                ref={primerCampoRef}
                name="nombre_completo"
                type="text"
                autoComplete="name"
                value={valores.nombre_completo}
                onChange={(e) => set("nombre_completo", e.target.value)}
              />
              {campoError("nombre_completo")}
            </label>

            <label className="form-field">
              <span className="form-label">Fecha de nacimiento *</span>
              <input
                name="fecha_nacimiento"
                type="date"
                value={valores.fecha_nacimiento}
                onChange={(e) => set("fecha_nacimiento", e.target.value)}
              />
              {campoError("fecha_nacimiento")}
            </label>

            <div className="form-field">
              <span className="form-label">Género *</span>
              <div className="radio-group">
                {GENEROS.map((g) => (
                  <label className="radio-pill" key={g}>
                    <input
                      type="radio"
                      name="genero"
                      value={g}
                      checked={valores.genero === g}
                      onChange={(e) => set("genero", e.target.value)}
                    />
                    <span>{g}</span>
                  </label>
                ))}
              </div>
              {campoError("genero")}
            </div>

            <label className="form-field">
              <span className="form-label">Años de práctica *</span>
              <input
                name="anios_practica"
                type="number"
                step="0.1"
                min="0"
                value={valores.anios_practica}
                onChange={(e) => onAniosChange(e.target.value)}
              />
              <span className="form-hint">
                Decimal. Ej. 1.5 = 1 año 6 meses. El nivel se sugiere
                automáticamente.
              </span>
              {campoError("anios_practica")}
            </label>

            <label className="form-field">
              <span className="form-label">Nivel *</span>
              <select
                name="nivel"
                value={valores.nivel}
                onChange={(e) => {
                  setNivelTocado(true);
                  set("nivel", e.target.value);
                }}
              >
                <option value="">Selecciona…</option>
                {NIVELES.map((n) => (
                  <option value={n} key={n}>
                    {n}
                  </option>
                ))}
              </select>
              {campoError("nivel")}
            </label>

            <label className="form-field">
              <span className="form-label">Peso de referencia (kg) *</span>
              <input
                name="peso_referencia_kg"
                type="number"
                step="0.1"
                min="0.1"
                value={valores.peso_referencia_kg}
                onChange={(e) => set("peso_referencia_kg", e.target.value)}
              />
              {campoError("peso_referencia_kg")}
            </label>

            <label className="form-field">
              <span className="form-label">Academia</span>
              <input
                name="academia"
                type="text"
                value={valores.academia}
                onChange={(e) => set("academia", e.target.value)}
              />
            </label>

            <label className="form-field">
              <span className="form-label">País</span>
              <input
                name="pais"
                type="text"
                value={valores.pais}
                onChange={(e) => set("pais", e.target.value)}
              />
            </label>

            <label className="form-field form-field-full">
              <span className="form-label">Foto URL</span>
              <input
                name="foto_url"
                type="url"
                placeholder="https://..."
                value={valores.foto_url}
                onChange={(e) => set("foto_url", e.target.value)}
              />
              {campoError("foto_url")}
            </label>
          </div>

          {(division || categoria) && (
            <p className="form-hint" aria-live="polite">
              Según el reglamento:{" "}
              {division ? (
                <strong>{division}</strong>
              ) : (
                <em>edad fuera de rango</em>
              )}
              {categoria && (
                <>
                  {" · "}
                  <strong>{categoria.nombre}</strong>
                </>
              )}
            </p>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-cancel"
              onClick={onClose}
              disabled={guardar.isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-save"
              disabled={guardar.isPending}
            >
              {guardar.isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
