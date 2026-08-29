"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamiento de foco de un modal (N20):
 *   - al montar, enfoca `focoInicial` (o el primer focusable del diálogo);
 *   - Tab/Shift+Tab quedan atrapados dentro del diálogo;
 *   - Escape llama onClose;
 *   - al desmontar, el foco vuelve al elemento que abrió el modal.
 *
 * Era código repetido en AtletaForm, EventoForm e InscribirAtletasModal;
 * ahora lo comparten también FinalizarModal y el modal de mover categoría.
 */
export default function useModalFocus(
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  focoInicial?: RefObject<HTMLElement | null>,
) {
  const disparadorRef = useRef<HTMLElement | null>(null);

  // Foco inicial y restauración al cerrar.
  useEffect(() => {
    disparadorRef.current = document.activeElement as HTMLElement | null;
    const inicial =
      focoInicial?.current ??
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      null;
    inicial?.focus();
    return () => disparadorRef.current?.focus?.();
    // Solo al montar/desmontar: los refs son estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const foco = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
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
  }, [dialogRef, onClose]);
}
