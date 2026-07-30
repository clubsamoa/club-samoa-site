import type { Metadata } from "next";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export const metadata: Metadata = { title: "Atletas · Admin · Club Samoa" };

// Placeholder del shell (N12). El catálogo real es la tarea N13.
export default function AtletasPage() {
  return (
    <>
      <AdminPageHeader
        title="Atletas"
        subtitle="Catálogo de competidores del club"
        actions={
          <button className="button button-primary" type="button" disabled>
            Nuevo atleta
          </button>
        }
      />
      <p className="admin-nav-empty">El catálogo de atletas llega en N13.</p>
    </>
  );
}
