import type { Metadata } from "next";
import ScoreboardPublicoView from "@/components/publico/ScoreboardPublicoView";
import "@/app/admin.css";

// Scoreboard público de proyección (puerto de scoreboard-public.html), fuera
// del gate de auth (decisión D3). Sigue automáticamente a la pelea activa
// que publica el admin; ?pelea_id=pel_XXX lo fija a una pelea concreta.

export const metadata: Metadata = {
  title: "Scoreboard público · Club Samoa",
  robots: { index: false },
};

export default async function ScoreboardPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventoId: string }>;
  searchParams: Promise<{ pelea_id?: string }>;
}) {
  const { eventoId } = await params;
  const { pelea_id } = await searchParams;
  return (
    <ScoreboardPublicoView
      key={eventoId}
      eventoId={eventoId}
      peleaIdInicial={pelea_id}
    />
  );
}
