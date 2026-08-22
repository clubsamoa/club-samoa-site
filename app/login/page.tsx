import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hayPasswordConfigurada } from "@/lib/auth-password";
import LoginForm from "@/components/admin/LoginForm";
import "./login.css";

export const metadata: Metadata = {
  title: "Acceso staff · Club Samoa",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const session = await auth();
  if (session) redirect(from && from.startsWith("/admin") ? from : "/admin");

  const configurada = hayPasswordConfigurada();

  return (
    <main className="login-main">
      <section className="login-card">
        <p className="eyebrow">Acceso staff</p>
        <h2>Panel de administración</h2>
        <p className="login-copy">
          Escribe la contraseña del staff para gestionar atletas, eventos y
          brackets.
        </p>

        {configurada ? (
          <LoginForm from={from} />
        ) : (
          <p className="form-status is-error" role="alert">
            Falta configurar <code>ADMIN_PASSWORD_HASH</code> en el entorno.
            Mientras no exista, nadie puede entrar.
          </p>
        )}
      </section>
    </main>
  );
}
