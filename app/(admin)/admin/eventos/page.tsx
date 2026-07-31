import type { Metadata } from "next";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import EventosListado from "@/components/admin/EventosListado";

export const metadata: Metadata = { title: "Eventos · Admin · Club Samoa" };

export default function EventosPage() {
  return (
    <>
      <AdminPageHeader
        title="Eventos"
        subtitle="Brackets MMA — gestión de eventos del club"
      />
      <EventosListado />
    </>
  );
}
