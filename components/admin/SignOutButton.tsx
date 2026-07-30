import { signOut } from "@/lib/auth";

// Botón de cerrar sesión. El shell del admin lo coloca en el header (N12).
export default function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button className="button button-secondary" type="submit">
        Salir
      </button>
    </form>
  );
}
