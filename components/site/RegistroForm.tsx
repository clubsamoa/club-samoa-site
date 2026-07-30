"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import SocialIcon from "@/components/site/SocialIcon";
import { submitRegistro } from "@/app/(site)/alumnos/actions";
import { WHATSAPP_URL } from "@/lib/constants";
import type { FormVariant, RegistroState } from "@/lib/registros";

// Envoltura cliente de los formularios de registro. Replica la UX de
// legacy/script.js: botón "Enviando...", validación del grupo de checkboxes
// vía setCustomValidity, y al éxito oculta el form y muestra el panel de
// confirmación con el submission_id.
//
// El submit es manual (preventDefault + formAction(formData)) en lugar del
// prop action del <form>: React 19 resetea los campos no controlados al
// completarse una action de formulario, y eso borraría lo escrito cuando el
// backend devuelve error. Legacy solo reseteaba en éxito.

const INITIAL_STATE: RegistroState = { status: "idle" };

export default function RegistroForm({
  variant,
  submitLabel,
  confirmationEyebrow,
  confirmationTitle,
  children,
}: {
  variant: FormVariant;
  submitLabel: string;
  confirmationEyebrow: string;
  confirmationTitle: string;
  children: React.ReactNode;
}) {
  const [state, formAction, isPending] = useActionState(
    submitRegistro.bind(null, variant),
    INITIAL_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const confirmationRef = useRef<HTMLElement>(null);

  // Validación del grupo de checkboxes (puerto de script.js:97-115): el
  // primer checkbox del grupo lleva el custom validity para que
  // reportValidity() muestre el globo nativo.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const groups = form.querySelectorAll<HTMLElement>(
      "[data-required-checkbox-group]",
    );
    const validate = () => {
      for (const group of groups) {
        const checkboxes = group.querySelectorAll<HTMLInputElement>(
          'input[type="checkbox"]',
        );
        const first = checkboxes[0];
        if (!first) continue;
        const hasChecked = Array.from(checkboxes).some((c) => c.checked);
        first.setCustomValidity(
          hasChecked ? "" : "Selecciona al menos una opción.",
        );
      }
    };
    validate();
    form.addEventListener("change", validate);
    return () => form.removeEventListener("change", validate);
  }, []);

  useEffect(() => {
    if (state.status === "success") {
      // Como en legacy: reset solo en éxito, antes de mostrar el panel.
      formRef.current?.reset();
      confirmationRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [state.status]);

  const isSuccess = state.status === "success";

  return (
    <>
      <form
        className="data-form"
        ref={formRef}
        hidden={isSuccess}
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          if (!form.reportValidity()) return;
          const formData = new FormData(form);
          startTransition(() => formAction(formData));
        }}
      >
        {children}
        <p
          className={`form-status${state.status === "error" ? " is-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {state.status === "error" ? state.message : ""}
        </p>
        <button
          className="button button-primary"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Enviando..." : submitLabel}
        </button>
      </form>
      <article
        className="request-confirmation"
        ref={confirmationRef}
        hidden={!isSuccess}
      >
        <p className="eyebrow">{confirmationEyebrow}</p>
        <h2>{confirmationTitle}</h2>
        <p>Envía un screenshot tu comprobante a whatsapp</p>
        <strong className="request-confirmation-id">
          {isSuccess ? state.submissionId : ""}
        </strong>
        <span>Screenshot de esta pantalla</span>
        <a
          className="button button-primary"
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
        >
          <SocialIcon type="whatsapp" />
          Enviar por WhatsApp
        </a>
      </article>
    </>
  );
}
