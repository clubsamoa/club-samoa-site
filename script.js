const whatsappNumber = "528333110858";
const whatsappBaseUrl = `https://wa.me/${whatsappNumber}`;
const registrationEndpoint = (window.CLUB_SAMOA_REGISTRATION_ENDPOINT || "").trim();

const whatsappAnchor = document.querySelector("#whatsapp-link");
const navDropdowns = document.querySelectorAll(".nav-dropdown");
const registrationForms = document.querySelectorAll("[data-form-type]");

if (whatsappAnchor) {
  whatsappAnchor.href = whatsappBaseUrl;
}

const closeAllDropdowns = () => {
  navDropdowns.forEach((dropdown) => {
    dropdown.classList.remove("is-open");
    const button = dropdown.querySelector(".nav-dropdown-toggle");
    const menu = dropdown.querySelector(".nav-dropdown-menu");
    if (button) {
      button.setAttribute("aria-expanded", "false");
    }
    if (menu) {
      menu.hidden = true;
    }
  });
};

navDropdowns.forEach((dropdown) => {
  const button = dropdown.querySelector(".nav-dropdown-toggle");
  const menu = dropdown.querySelector(".nav-dropdown-menu");

  if (!button || !menu) {
    return;
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !dropdown.classList.contains("is-open");
    closeAllDropdowns();
    dropdown.classList.toggle("is-open", willOpen);
    button.setAttribute("aria-expanded", willOpen ? "true" : "false");
    menu.hidden = !willOpen;
  });

  menu.addEventListener("click", (event) => {
    event.stopPropagation();
  });
});

closeAllDropdowns();

document.addEventListener("click", () => {
  closeAllDropdowns();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllDropdowns();
  }
});

const isRegistrationConfigured = () => {
  return registrationEndpoint && !registrationEndpoint.includes("PASTE_APPS_SCRIPT");
};

const createSubmissionId = () => {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `club-samoa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const setFormStatus = (form, message, state = "") => {
  const status = form.querySelector("[data-form-status]");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.classList.toggle("is-success", state === "success");
  status.classList.toggle("is-error", state === "error");
};

const setSubmitState = (button, isSubmitting) => {
  if (!button) {
    return;
  }

  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent.trim();
  }

  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? "Enviando..." : button.dataset.defaultLabel;
};

const buildRegistrationPayload = (form) => {
  const formData = new FormData(form);
  const formType = form.getAttribute("data-form-type");
  const payload = new URLSearchParams();

  formData.forEach((value, key) => {
    payload.append(key, String(value).trim());
  });

  payload.set("form_type", formType);
  payload.set("submission_id", createSubmissionId());
  payload.set("page_url", window.location.href);
  payload.set("user_agent", window.navigator.userAgent);

  return payload;
};

registrationForms.forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    if (!isRegistrationConfigured()) {
      setFormStatus(
        form,
        "El registro en línea está listo, pero falta conectar la URL de Google Apps Script.",
        "error",
      );
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const payload = buildRegistrationPayload(form);

    setSubmitState(submitButton, true);
    setFormStatus(form, "");

    fetch(registrationEndpoint, {
      method: "POST",
      mode: "no-cors",
      body: payload,
    })
      .then(() => {
        form.reset();
        setFormStatus(form, "Registro enviado correctamente.", "success");
      })
      .catch(() => {
        setFormStatus(
          form,
          "No se pudo enviar el registro. Intenta de nuevo en un momento.",
          "error",
        );
      })
      .finally(() => {
        setSubmitState(submitButton, false);
      });
  });
});
