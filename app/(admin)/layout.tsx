import Image from "next/image";
import Link from "next/link";
import AdminSidebar from "@/components/admin/AdminSidebar";
import GlobalSpinner from "@/components/admin/GlobalSpinner";
import Providers from "@/components/admin/Providers";
import SignOutButton from "@/components/admin/SignOutButton";
import { auth } from "@/lib/auth";
import "../admin.css";
import "./admin-extras.css";

// Reemplaza legacy/admin/js/shell.js (267 líneas de inyección por DOM) por un
// layout real. El gate de sesión lo aplica proxy.ts; aquí solo se lee la
// sesión para mostrar quién está dentro.

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <Providers>
      <div className="admin-shell">
        <header className="admin-header">
          <Link className="admin-brand" href="/admin/eventos">
            <Image
              src="/images/logo-white.png"
              alt="Club Samoa"
              width={480}
              height={600}
            />
            <div className="admin-brand-text">
              <strong>Club Samoa</strong>
              <span>Admin · Eventos MMA</span>
            </div>
          </Link>
          <div className="admin-header-actions">
            {session?.user?.email && (
              <span className="admin-header-user" title="Sesión activa">
                {session.user.email}
              </span>
            )}
            <Link
              className="admin-header-link"
              href="/"
              title="Volver al sitio público"
            >
              ← Sitio
            </Link>
            <SignOutButton />
          </div>
        </header>

        <AdminSidebar />

        <main className="admin-main">{children}</main>
      </div>
      <GlobalSpinner />
    </Providers>
  );
}
