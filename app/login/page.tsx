import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import "./login.css";

export const metadata: Metadata = {
  title: "Acceso staff · Club Samoa",
  robots: { index: false, follow: false },
};

// Errores que devuelve Auth.js en ?error=. AccessDenied es el caso de un
// correo fuera de la allowlist: merece un mensaje claro, no uno genérico.
function mensajeError(error: string | undefined): string | null {
  if (!error) return null;
  if (error === "AccessDenied") {
    return "Esa cuenta de Google no tiene acceso al panel. Si crees que debería tenerlo, pide que agreguen tu correo.";
  }
  return "No se pudo completar el acceso. Intenta de nuevo.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;
  const session = await auth();
  if (session) redirect(from && from.startsWith("/admin") ? from : "/admin");

  const mensaje = mensajeError(error);

  return (
    <main className="login-main">
      <section className="login-card">
        <p className="eyebrow">Acceso staff</p>
        <h2>Panel de administración</h2>
        <p className="login-copy">
          Entra con la cuenta de Google autorizada del club para gestionar
          atletas, eventos y brackets.
        </p>

        {mensaje && (
          <p className="form-status is-error" role="alert">
            {mensaje}
          </p>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", {
              redirectTo: from && from.startsWith("/admin") ? from : "/admin",
            });
          }}
        >
          <button className="button button-primary" type="submit">
            Entrar con Google
          </button>
        </form>
      </section>
    </main>
  );
}
