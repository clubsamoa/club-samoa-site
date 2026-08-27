import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "@/lib/auth.config";
import {
  estaBloqueado,
  limpiarIntentos,
  registrarFallo,
  verificarPassword,
} from "@/lib/auth-password";

// Auth.js v5 con una sola contraseña compartida para el staff del club.
//
// La contraseña se compara SIEMPRE en el servidor, contra un hash bcrypt que
// vive en ADMIN_PASSWORD_HASH. El navegador nunca ve el hash ni la
// contraseña correcta.
//
// Este módulo corre en Node (bcrypt no funciona en edge). proxy.ts usa
// lib/auth.config.ts, que no lo importa.

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Contraseña del staff",
      credentials: {
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, request) {
        const ip =
          request?.headers?.get("x-nf-client-connection-ip") ??
          request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "desconocida";

        if (estaBloqueado(ip)) return null;

        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        const ok = await verificarPassword(password);

        if (!ok) {
          registrarFallo(ip);
          return null;
        }

        limpiarIntentos(ip);
        // No hay identidad individual: es una sesión de staff compartida.
        return { id: "staff", name: "Staff Club Samoa" };
      },
    }),
  ],
});
