const whatsappNumber = "528333110858";
const whatsappBaseUrl = `https://wa.me/${whatsappNumber}`;

const whatsappAnchor = document.querySelector("#whatsapp-link");
const navDropdowns = document.querySelectorAll(".nav-dropdown");

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

const buildUniformMessage = (formData) => {
  return [
    "Hola, quiero hacer un pedido de uniforme.",
    `Alumno: ${formData.get("nombre")}`,
    `Talla: ${formData.get("talla")}`,
    `Cantidad: ${formData.get("cantidad")}`,
    `Notas: ${formData.get("notas") || "Sin notas adicionales"}`,
  ].join("\n");
};

const buildExamMessage = (formData) => {
  return [
    "Hola, quiero registrarme a un examen de cambio de grado.",
    `Alumno: ${formData.get("nombre")}`,
    `Grado actual: ${formData.get("grado")}`,
    `Fecha de examen: ${formData.get("fecha")}`,
    `Observaciones: ${formData.get("notas") || "Sin observaciones"}`,
  ].join("\n");
};

document.querySelectorAll("[data-form-type]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const formType = form.getAttribute("data-form-type");

    const message =
      formType === "uniforme"
        ? buildUniformMessage(formData)
        : buildExamMessage(formData);

    const url = `${whatsappBaseUrl}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  });
});
