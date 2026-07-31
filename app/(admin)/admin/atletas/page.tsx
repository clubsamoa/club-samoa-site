import type { Metadata } from "next";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AtletasListado from "@/components/admin/AtletasListado";

export const metadata: Metadata = { title: "Atletas · Admin · Club Samoa" };

export default function AtletasPage() {
  return (
    <>
      <AdminPageHeader
        title="Atletas"
        subtitle="Catálogo de competidores del club"
      />
      <AtletasListado />
    </>
  );
}
