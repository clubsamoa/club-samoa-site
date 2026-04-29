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

const validateCheckboxGroups = (form) => {
  const groups = form.querySelectorAll("[data-required-checkbox-group]");
  let isValid = true;

  groups.forEach((group) => {
    const checkboxes = group.querySelectorAll('input[type="checkbox"]');
    const firstCheckbox = checkboxes[0];
    const hasCheckedOption = Array.from(checkboxes).some((checkbox) => checkbox.checked);

    if (!firstCheckbox) {
      return;
    }

    firstCheckbox.setCustomValidity(hasCheckedOption ? "" : "Selecciona al menos una opción.");
    isValid = isValid && hasCheckedOption;
  });

  return isValid;
};

const buildRegistrationPayload = (form) => {
  const formData = new FormData(form);
  const formType = form.getAttribute("data-form-type");
  const submissionId = createSubmissionId();
  const payload = new URLSearchParams();
  const valuesByKey = new Map();

  formData.forEach((value, key) => {
    const cleanValue = String(value).trim();
    if (!cleanValue) {
      return;
    }

    const values = valuesByKey.get(key) || [];
    values.push(cleanValue);
    valuesByKey.set(key, values);
  });

  valuesByKey.forEach((values, key) => {
    payload.set(key, values.join(", "));
  });

  payload.set("form_type", formType);
  payload.set("submission_id", submissionId);
  payload.set("page_url", window.location.href);
  payload.set("user_agent", window.navigator.userAgent);

  return { payload, submissionId };
};

const showConfirmationPanel = (form, submissionId) => {
  const section = form.closest(".student-section");
  const confirmationPanel = section ? section.querySelector("[data-confirmation-panel]") : null;
  const confirmationId = confirmationPanel ? confirmationPanel.querySelector("[data-confirmation-id]") : null;

  if (!confirmationPanel || !confirmationId) {
    setFormStatus(form, "Registro enviado correctamente.", "success");
    return;
  }

  confirmationId.textContent = submissionId;
  form.hidden = true;
  confirmationPanel.hidden = false;
  confirmationPanel.scrollIntoView({ behavior: "smooth", block: "center" });
};

registrationForms.forEach((form) => {
  form.querySelectorAll("[data-required-checkbox-group] input").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      validateCheckboxGroups(form);
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const hasValidCheckboxGroups = validateCheckboxGroups(form);
    if (!form.reportValidity() || !hasValidCheckboxGroups) {
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
    const { payload, submissionId } = buildRegistrationPayload(form);

    setSubmitState(submitButton, true);
    setFormStatus(form, "");

    fetch(registrationEndpoint, {
      method: "POST",
      mode: "no-cors",
      body: payload,
    })
      .then(() => {
        form.reset();
        showConfirmationPanel(form, submissionId);
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
