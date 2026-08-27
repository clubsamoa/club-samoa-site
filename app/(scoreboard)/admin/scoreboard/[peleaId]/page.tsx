import type { Metadata } from "next";
import Scoreboard from "@/components/admin/Scoreboard/Scoreboard";
import "@/app/admin.css";

// Consola del operador (puerto de legacy/admin/scoreboard.html). Vive en su
// propio grupo de rutas para NO heredar el shell del admin (sidebar/header):
// es una pantalla de operación a pantalla completa, como en legacy. La URL
// sigue bajo /admin/*, así que proxy.ts la protege igual.

export const metadata: Metadata = {
  title: "Scoreboard · Club Samoa",
  robots: { index: false },
};

export default async function ScoreboardPage({
  params,
}: {
  params: Promise<{ peleaId: string }>;
}) {
  const { peleaId } = await params;
  return <Scoreboard key={peleaId} peleaId={peleaId} />;
}
