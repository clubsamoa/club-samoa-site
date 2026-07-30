// Allowlist de correos con acceso al admin. Módulo separado de lib/auth.ts
// (que arrastra NextAuth) para poder probarlo como lógica pura y para que el
// Route Handler lo importe sin costo.

/** Correos autorizados, normalizados a minúsculas y sin espacios. */
export function allowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = allowedEmails();
  // Sin allowlist configurada, nadie entra. Fallar cerrado es lo correcto:
  // una variable de entorno olvidada no debe abrir el admin.
  if (allowed.length === 0) return false;
  // Comparación exacta, nunca substring: "staff@x.com.attacker.net" no debe
  // pasar por contener "staff@x.com".
  return allowed.includes(email.trim().toLowerCase());
}
