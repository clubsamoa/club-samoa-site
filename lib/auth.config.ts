import type { NextAuthConfig } from "next-auth";

// Configuración compartida y "edge-safe": la usa proxy.ts, que corre en el
// runtime edge y NO puede cargar bcrypt. El proveedor de credenciales (que sí
// necesita bcrypt) se añade solo en lib/auth.ts, que corre en Node.
export default {
  providers: [],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 h: cubre un día de evento sin re-login
  },
  trustHost: true,
} satisfies NextAuthConfig;
