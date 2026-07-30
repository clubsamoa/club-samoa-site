import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/auth-allowlist";

// Auth.js v5 con Google como único proveedor. No hay contraseñas propias:
// Google verifica la identidad y nosotros solo comprobamos que el correo esté
// en la allowlist. Dar o quitar acceso al admin = editar una variable de
// entorno (ADMIN_ALLOWED_EMAILS).

export { allowedEmails, isAllowedEmail } from "@/lib/auth-allowlist";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    signIn({ profile }) {
      // Google marca email_verified; exigirlo evita que un correo no
      // confirmado coincida con la allowlist.
      if (profile && profile.email_verified === false) return false;
      return isAllowedEmail(profile?.email);
    },
    // Segunda barrera: aunque exista una cookie de sesión vieja, si el correo
    // ya no está en la allowlist la sesión deja de ser válida.
    session({ session }) {
      if (!isAllowedEmail(session.user?.email)) {
        return null as unknown as typeof session;
      }
      return session;
    },
  },
});
