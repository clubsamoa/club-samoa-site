/**
 * Shell del admin: inyecta header + sidebar a partir de los data-attrs
 * del <body>. Cada página solo declara su contenido principal.
 *
 * Uso:
 *   <body data-section="eventos" data-title="Eventos" data-subtitle="...">
 *     <main class="admin-main">...</main>
 *   </body>
 *
 * data-section: clave del item de nav activo. Una de: eventos, atletas,
 *               tools.
 * data-title: título grande de la página (inyectado en admin-main-header).
 * data-subtitle: texto secundario opcional bajo el título.
 *
 * El shell envuelve el contenido en .admin-shell. La página puede tener
 * actions del header con un <div data-slot="main-actions"> dentro del
 * main; el shell lo mueve al header.
 */
(function () {
  "use strict";

  var NAV_ITEMS = [
    { key: "eventos", label: "Eventos", icon: "🥊", href: "./eventos.html" },
    { key: "atletas", label: "Atletas", icon: "👥", href: "./atletas.html" },
  ];

  var TOOLS_ITEMS = [
    {
      key: "tools-reglamento",
      label: "Tests · reglamento",
      icon: "·",
      href: "./js/reglamento.test.html",
    },
    {
      key: "tools-api",
      label: "Tests · api",
      icon: "·",
      href: "./js/api.test.html",
    },
    {
      key: "tools-atletas-api",
      label: "Tests · atletas API",
      icon: "·",
      href: "./js/atletas-api.test.html",
    },
    {
      key: "tools-atletas-seed",
      label: "Seed · atletas demo",
      icon: "+",
      href: "./js/atletas-seed.html",
    },
    {
      key: "tools-eventos-api",
      label: "Tests · eventos API",
      icon: "·",
      href: "./js/eventos-api.test.html",
    },
    {
      key: "tools-inscripciones-api",
      label: "Tests · inscripciones API",
      icon: "·",
      href: "./js/inscripciones-api.test.html",
    },
    {
      key: "tools-bracket-builder",
      label: "Tests · bracket builder",
      icon: "·",
      href: "./js/bracket-builder.test.html",
    },
    {
      key: "tools-brackets-api",
      label: "Tests · brackets API",
      icon: "·",
      href: "./js/brackets-api.test.html",
    },
    {
      key: "tools-bracket-svg",
      label: "Tests · bracket SVG",
      icon: "·",
      href: "./js/bracket-svg.test.html",
    },
  ];

  function init() {
    if (document.body.dataset.shellInjected === "true") return;

    var section = document.body.dataset.section || "";
    var title = document.body.dataset.title || "Admin";
    var subtitle = document.body.dataset.subtitle || "";

    // Capturamos el main existente para reubicarlo dentro del shell.
    var existingMain = document.body.querySelector("main.admin-main");
    if (!existingMain) {
      existingMain = document.createElement("main");
      existingMain.className = "admin-main";
      // Mueve todo el contenido actual del body al main (excluyendo scripts).
      while (document.body.firstChild) {
        var node = document.body.firstChild;
        if (
          node.nodeType === 1 &&
          (node.tagName === "SCRIPT" || node.tagName === "LINK")
        ) {
          document.body.removeChild(node);
          continue;
        }
        existingMain.appendChild(node);
      }
    } else {
      existingMain.parentNode.removeChild(existingMain);
    }

    var actionsSlot = existingMain.querySelector('[data-slot="main-actions"]');

    // Construimos el shell.
    var shell = document.createElement("div");
    shell.className = "admin-shell";

    shell.appendChild(buildHeader());
    shell.appendChild(buildSidebar(section));

    // Header de página dentro del main.
    var pageHeader = document.createElement("header");
    pageHeader.className = "admin-main-header";
    var titleWrap = document.createElement("div");
    var h1 = document.createElement("h1");
    h1.textContent = title;
    titleWrap.appendChild(h1);
    if (subtitle) {
      var sub = document.createElement("div");
      sub.className = "admin-subtitle";
      sub.textContent = subtitle;
      titleWrap.appendChild(sub);
    }
    pageHeader.appendChild(titleWrap);

    if (actionsSlot) {
      actionsSlot.classList.add("admin-main-actions");
      pageHeader.appendChild(actionsSlot);
    }

    // Insertamos pageHeader al inicio del main.
    existingMain.insertBefore(pageHeader, existingMain.firstChild);
    shell.appendChild(existingMain);

    document.body.insertBefore(shell, document.body.firstChild);
    document.body.dataset.shellInjected = "true";

    // Title tag del documento.
    if (!document.title || document.title === "") {
      document.title = title + " · Admin · Club Samoa";
    }
  }

  function buildHeader() {
    var header = document.createElement("header");
    header.className = "admin-header";

    var brand = document.createElement("a");
    brand.className = "admin-brand";
    brand.href = "./eventos.html";

    var logo = document.createElement("img");
    logo.src = "../images/logo-white.png";
    logo.alt = "Club Samoa";
    brand.appendChild(logo);

    var text = document.createElement("div");
    text.className = "admin-brand-text";
    var strong = document.createElement("strong");
    strong.textContent = "Club Samoa";
    var span = document.createElement("span");
    span.textContent = "Admin · Eventos MMA";
    text.appendChild(strong);
    text.appendChild(span);
    brand.appendChild(text);

    var actions = document.createElement("div");
    actions.className = "admin-header-actions";

    var siteLink = document.createElement("a");
    siteLink.className = "admin-header-link";
    siteLink.href = "../index.html";
    siteLink.textContent = "← Sitio";
    siteLink.title = "Volver al sitio público";
    actions.appendChild(siteLink);

    header.appendChild(brand);
    header.appendChild(actions);
    return header;
  }

  function buildSidebar(activeKey) {
    var aside = document.createElement("aside");
    aside.className = "admin-sidebar";

    aside.appendChild(buildSidebarSection("Principal"));
    aside.appendChild(buildNav(NAV_ITEMS, activeKey));

    aside.appendChild(buildSidebarSection("Dev / Tests"));
    aside.appendChild(buildNav(TOOLS_ITEMS, activeKey));

    return aside;
  }

  function buildSidebarSection(label) {
    var div = document.createElement("div");
    div.className = "admin-sidebar-section";
    div.textContent = label;
    return div;
  }

  function buildNav(items, activeKey) {
    var nav = document.createElement("nav");
    nav.className = "admin-nav";
    items.forEach(function (item) {
      var a = document.createElement("a");
      a.href = item.href;
      a.dataset.section = item.key;
      if (item.key === activeKey) a.classList.add("is-active");
      var icon = document.createElement("span");
      icon.className = "admin-nav-icon";
      icon.textContent = item.icon;
      var label = document.createElement("span");
      label.textContent = item.label;
      a.appendChild(icon);
      a.appendChild(label);
      nav.appendChild(a);
    });
    return nav;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
