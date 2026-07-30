// Placeholder: vista pública de bracket, fuera del gate de auth (D3).
// La vista real es N16.
export default async function BracketPublico({
  params,
}: {
  params: Promise<{ bracketId: string }>;
}) {
  const { bracketId } = await params;
  return <main style={{ padding: "2rem" }}>Bracket público: {bracketId}</main>;
}
