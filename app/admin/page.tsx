import { auth } from "@/lib/auth";

// Placeholder para verificar el gate de auth (N11). El shell real es N12.
export default async function AdminHome() {
  const session = await auth();
  return (
    <main style={{ padding: "2rem" }}>
      <h2>Panel de administración</h2>
      <p>Sesión de: {session?.user?.email ?? "(sin sesión)"}</p>
      <p>El shell real del admin es la tarea N12.</p>
    </main>
  );
}
