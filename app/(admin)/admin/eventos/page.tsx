import type { Metadata } from "next";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export const metadata: Metadata = { title: "Eventos · Admin · Club Samoa" };

// Placeholder del shell (N12). El listado real es la tarea N14.
export default function EventosPage() {
  return (
    <>
      <AdminPageHeader
        title="Eventos"
        subtitle="Brackets MMA — gestión de eventos del club"
        actions={
          <button className="button button-primary" type="button" disabled>
            Nuevo evento
          </button>
        }
      />
      <p className="admin-nav-empty">El listado de eventos llega en N14.</p>
    </>
  );
}
