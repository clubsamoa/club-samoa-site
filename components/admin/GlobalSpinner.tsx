"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";

// Indicador global de "algo está en vuelo". Sustituye el contador manual de
// requests y el spinner inyectado a mano de legacy/admin/js/api.js:65-118;
// ahora el estado lo lleva TanStack Query.
export default function GlobalSpinner() {
  const isBusy = useIsFetching() + useIsMutating() > 0;
  return (
    <div
      className={`cs-api-spinner${isBusy ? " is-visible" : ""}`}
      role="status"
      aria-label="Cargando"
      data-testid="cs-api-spinner"
    />
  );
}
