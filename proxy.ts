import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/lib/auth.config";

// Protege /admin/*. Las vistas públicas de proyección (/scoreboard/* y
// /bracket/*) quedan FUERA a propósito: se proyectan en pantalla durante los
// eventos y no pueden pedir login (decisión D3 del PLAN).
//
// El proxy protege páginas. Las escrituras de /api/eventos/* verifican la
// sesión por su cuenta en el Route Handler — no basta con esto.
//
// Se instancia con auth.config (sin proveedores) porque este archivo corre en
// el runtime edge y bcrypt no funciona ahí. Para decidir "hay sesión o no"
// basta con leer el JWT, que es lo que hace esta instancia.
//
// Nota: en Next 16 esta convención se llama proxy.ts (antes middleware.ts).

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  if (!request.auth) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    // Para volver a donde se quería entrar después del login.
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
