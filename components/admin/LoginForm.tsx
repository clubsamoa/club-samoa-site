"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

// Formulario de acceso del staff. La contraseña viaja al servidor y se
// compara ahí contra el hash; el navegador nunca conoce la correcta.
export default function LoginForm({ from }: { from?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const destino = from && from.startsWith("/admin") ? from : "/admin";

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const res = await signIn("credentials", {
        password,
        redirect: false,
      });
      if (res?.error) {
        // Mensaje deliberadamente vago: no distingue "contraseña incorrecta"
        // de "demasiados intentos" para no dar pistas a quien la adivina.
        setError(
          "Contraseña incorrecta. Si insistes, el acceso se bloquea un rato.",
        );
        setPassword("");
        return;
      }
      router.replace(destino);
      router.refresh();
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      {error && (
        <p className="form-status is-error" role="alert">
          {error}
        </p>
      )}
      <label className="form-field">
        <span className="form-label">Contraseña</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button
        className="button button-primary"
        type="submit"
        disabled={enviando || password.length === 0}
      >
        {enviando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
