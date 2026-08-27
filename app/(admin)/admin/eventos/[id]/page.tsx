import type { Metadata } from "next";
import EventoDetalle from "@/components/admin/EventoDetalle";

export const metadata: Metadata = { title: "Evento · Admin · Club Samoa" };

// Puerto de legacy/admin/evento.html. La pestaña activa vive en la URL
// (?tab=pesaje) en vez de en el hash: así sobrevive a un refresh y el enlace
// es compartible — en legacy se perdía al recargar.
export default async function EventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <EventoDetalle eventoId={id} tabInicial={tab} />;
}
