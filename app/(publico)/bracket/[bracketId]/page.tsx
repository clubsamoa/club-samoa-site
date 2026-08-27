import type { Metadata } from "next";
import BracketPublicoView from "@/components/publico/BracketPublicoView";
import "@/app/admin.css";

// Vista pública del bracket (puerto de legacy/admin/bracket.html), fuera del
// gate de auth (decisión D3): se proyecta en pantalla durante los eventos.
// Reusa admin.css — ahí viven los selectores .bracket-page y .bracket-svg-*.

export const metadata: Metadata = {
  title: "Bracket · Club Samoa",
  robots: { index: false },
};

export default async function BracketPublicoPage({
  params,
}: {
  params: Promise<{ bracketId: string }>;
}) {
  const { bracketId } = await params;
  return <BracketPublicoView bracketId={bracketId} />;
}
