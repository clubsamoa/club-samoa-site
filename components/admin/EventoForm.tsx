"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useToast } from "@/components/admin/Toaster";
import useModalFocus from "@/components/admin/useModalFocus";
import { ApiError, api } from "@/lib/api-client";
import type { Evento } from "@/lib/schemas";

// Puerto de legacy/admin/js/eventos-form.js: modal de alta y edición con los
// mismos 3 campos y las mismas reglas de validación (eventos-form.js:177-186).

const EventoFormSchema = z.object({
  nombre: z.string().trim().min(1, "Requerido"),
  fecha: z
    .string()
    .min(1, "Requerido")
    .refine((v) => !isNaN(new Date(v).getTime()), "Fecha inválida")
    .refine((v) => {
      const anio = new Date(v).getFullYear();
      return anio >= 1900 && anio <= 2100;
    }, "Año fuera de rango (1900–2100)"),
  sede: z.string().trim().min(1, "Requerido"),
});

type Campo = keyof z.infer<typeof EventoFormSchema>;

export default function EventoForm({
  evento,
  onClose,
}: {
  evento: Evento | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toastError, toastSuccess } = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primerCampoRef = useRef<HTMLInputElement>(null);

  const esEdicion = evento !== null;

  const [valores, setValores] = useState({
    nombre: evento?.nombre ?? "",
    fecha: evento?.fecha ?? "",
    sede: evento?.sede ?? "",
  });
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [errorBanner, setErrorBanner] = useState("");

  const set = (campo: Campo, valor: string) =>
    setValores((prev) => ({ ...prev, [campo]: valor }));

  useModalFocus(dialogRef, onClose, primerCampoRef);

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      esEdicion
        ? api.post("eventos.update", { id: evento.id, ...payload })
        : api.post("eventos.create", payload),
    onSuccess: () => {
      toastSuccess(esEdicion ? "Evento actualizado." : "Evento creado.");
      void queryClient.invalidateQueries({ queryKey: ["eventos.list"] });
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
    const parsed = EventoFormSchema.safeParse(valores);
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
        aria-labelledby="evento-form-title"
        ref={dialogRef}
      >
        <div className="modal-header">
          <h2 id="evento-form-title">
            {esEdicion ? "Editar evento" : "Nuevo evento"}
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
            <label className="form-field form-field-full">
              <span className="form-label">Nombre *</span>
              <input
                ref={primerCampoRef}
                name="nombre"
                type="text"
                autoComplete="off"
                placeholder="Campeonato Estatal Agosto 2026"
                value={valores.nombre}
                onChange={(e) => set("nombre", e.target.value)}
              />
              {campoError("nombre")}
            </label>

            <label className="form-field">
              <span className="form-label">Fecha *</span>
              <input
                name="fecha"
                type="date"
                value={valores.fecha}
                onChange={(e) => set("fecha", e.target.value)}
              />
              {campoError("fecha")}
            </label>

            <label className="form-field form-field-full">
              <span className="form-label">Sede *</span>
              <input
                name="sede"
                type="text"
                placeholder="Jaula Principal — Ciudad Juárez"
                value={valores.sede}
                onChange={(e) => set("sede", e.target.value)}
              />
              {campoError("sede")}
            </label>
          </div>

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
