"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { EventoSchema, parseOrWarn } from "@/lib/schemas";
import { z } from "zod";

// Puerto de loadEventosActivos_ (legacy/admin/js/shell.js:160-233): lista los
// eventos con estatus "activo" en el sidebar, ordenados por fecha, y resalta
// el que se está viendo. Carga async: no bloquea el render del sidebar.

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** "2026-08-15" → "15 ago". Formato de shell.js:224-233. */
export function formatFechaCorta(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!match) return String(iso);
  const mes = MESES_CORTOS[Number(match[2]) - 1];
  if (!mes) return String(iso);
  return `${Number(match[3])} ${mes}`;
}

const ResponseSchema = z.object({ eventos: z.array(EventoSchema).optional() });

export default function EventosActivosNav() {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  // Solo resaltamos cuando estamos en el detalle de un evento.
  const currentId = pathname.startsWith("/admin/eventos/") ? params.id : null;

  const { data, isPending, isError } = useQuery({
    queryKey: ["eventos.list"],
    queryFn: async () => {
      const raw = await api.get("eventos.list");
      return parseOrWarn(ResponseSchema, raw, "eventos.list");
    },
  });

  if (isPending) {
    return (
      <nav className="admin-nav admin-nav-eventos">
        <div className="admin-nav-empty">Cargando…</div>
      </nav>
    );
  }

  if (isError) {
    return (
      <nav className="admin-nav admin-nav-eventos">
        <div className="admin-nav-empty">No se pudieron cargar</div>
      </nav>
    );
  }

  const activos = (data.eventos ?? [])
    .filter((evento) => evento.estatus === "activo")
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  if (activos.length === 0) {
    return (
      <nav className="admin-nav admin-nav-eventos">
        <div className="admin-nav-empty">Sin eventos activos</div>
      </nav>
    );
  }

  return (
    <nav className="admin-nav admin-nav-eventos">
      {activos.map((evento) => (
        <Link
          key={evento.id}
          href={`/admin/eventos/${encodeURIComponent(evento.id)}`}
          className={`admin-nav-evento${evento.id === currentId ? " is-active" : ""}`}
        >
          <div className="admin-nav-evento-info">
            <strong className="admin-nav-evento-name">
              {evento.nombre || evento.id}
            </strong>
            {evento.fecha && (
              <span className="admin-nav-evento-fecha">
                {formatFechaCorta(evento.fecha)}
              </span>
            )}
          </div>
        </Link>
      ))}
    </nav>
  );
}
