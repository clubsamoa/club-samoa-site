"use server";

import { headers } from "next/headers";
import {
  FORM_VARIANTS,
  type FormVariant,
  type RegistroState,
} from "@/lib/registros";

// Envío de registros (uniformes/exámenes) al Apps Script de Code.gs.
//
// Reemplaza el fetch con mode:"no-cors" de legacy/script.js:193 — aquí el
// POST sale del servidor, así que por primera vez podemos leer la respuesta
// real del backend y reportar errores al alumno en vez de asumir éxito.

export async function submitRegistro(
  variant: FormVariant,
  _prev: RegistroState,
  formData: FormData,
): Promise<RegistroState> {
  const config = FORM_VARIANTS[variant];
  if (!config) return { status: "error", message: "Formulario desconocido." };

  const endpoint = process.env.APPS_SCRIPT_REGISTROS_URL;
  if (!endpoint) {
    return {
      status: "error",
      message:
        "El registro en línea está listo, pero falta conectar la URL de Google Apps Script.",
    };
  }

  // FormData → objeto plano. "producto" es el único campo multivalor.
  const raw: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    const values = formData
      .getAll(key)
      .map((v) => String(v).trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    raw[key] = key === "producto" ? values : values[values.length - 1];
  }

  const parsed = config.schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return {
      status: "error",
      message: "Revisa los campos marcados e intenta de nuevo.",
      fieldErrors,
    };
  }

  // Mismo shape de payload que legacy/script.js:117-145: multivalor unido
  // por ", ", más form_type / submission_id / page_url / user_agent.
  const submissionId = crypto.randomUUID();
  const requestHeaders = await headers();
  const payload = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    payload.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }
  payload.set("form_type", config.formType);
  payload.set("submission_id", submissionId);
  payload.set("page_url", `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/alumnos`);
  payload.set("user_agent", requestHeaders.get("user-agent") ?? "");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: payload,
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();

    let data: { ok?: boolean; error?: string } = {};
    try {
      data = JSON.parse(text) as { ok?: boolean; error?: string };
    } catch {
      return {
        status: "error",
        message:
          "El servidor respondió en un formato inesperado. Intenta de nuevo.",
      };
    }

    if (!response.ok || data.ok === false) {
      return {
        status: "error",
        message:
          data.error ??
          "No se pudo guardar el registro. Intenta de nuevo en un momento.",
      };
    }

    return { status: "success", submissionId };
  } catch {
    return {
      status: "error",
      message: "No se pudo enviar el registro. Intenta de nuevo en un momento.",
    };
  }
}
