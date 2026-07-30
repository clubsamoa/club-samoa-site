// Placeholder: verifica que la vista de proyección queda FUERA del gate de
// auth (decisión D3). La vista real es N18.
export default async function ScoreboardPublico({
  params,
}: {
  params: Promise<{ eventoId: string }>;
}) {
  const { eventoId } = await params;
  return (
    <main style={{ padding: "2rem" }}>Scoreboard público: {eventoId}</main>
  );
}
