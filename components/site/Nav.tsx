"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Puerto de los dropdowns de legacy/script.js:13-59: aria-expanded
// sincronizado, cierre por click fuera y Escape, click dentro no cierra.

type DropdownKey = "students" | "community";

const DROPDOWNS: Array<{
  key: DropdownKey;
  label: string;
  menuId: string;
  items: Array<{ href: string; label: string }>;
}> = [
  {
    key: "students",
    label: "Alumnos",
    menuId: "students-menu",
    items: [
      { href: "/alumnos", label: "Portal de alumnos" },
      { href: "/alumnos#uniformes", label: "Uniformes" },
      { href: "/alumnos#examenes", label: "Exámenes" },
    ],
  },
  {
    key: "community",
    label: "Comunidad",
    menuId: "community-menu",
    items: [
      { href: "/comunidad", label: "Precios y torneos" },
      { href: "/comunidad#precios", label: "Precios" },
      { href: "/comunidad#torneos", label: "Torneos" },
    ],
  },
];

export default function Nav() {
  const pathname = usePathname();
  const [openKey, setOpenKey] = useState<DropdownKey | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (openKey === null) return;

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      // Click dentro de un menú abierto no cierra (script.js:44-46).
      const menus = navRef.current?.querySelectorAll(".nav-dropdown-menu");
      for (const menu of menus ?? []) {
        if (menu.contains(target)) return;
      }
      setOpenKey(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openKey]);

  return (
    <nav className="site-nav" aria-label="Principal" ref={navRef}>
      <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
        Inicio
      </Link>
      <Link href="/#horarios">Horarios</Link>
      {DROPDOWNS.map((dropdown) => {
        const isOpen = openKey === dropdown.key;
        return (
          <div
            className={`nav-dropdown${isOpen ? " is-open" : ""}`}
            key={dropdown.key}
          >
            <button
              className="nav-dropdown-toggle"
              type="button"
              aria-expanded={isOpen}
              aria-controls={dropdown.menuId}
              onClick={(event) => {
                // stopPropagation: el listener de documento no debe cerrarlo
                // en el mismo click (script.js:36).
                event.stopPropagation();
                setOpenKey(isOpen ? null : dropdown.key);
              }}
            >
              {dropdown.label}{" "}
              <span className="dropdown-caret" aria-hidden="true">
                ⌄
              </span>
            </button>
            <div
              className="nav-dropdown-menu"
              id={dropdown.menuId}
              hidden={!isOpen}
            >
              {dropdown.items.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  onClick={() => setOpenKey(null)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
      <Link href="/#contacto">Contacto</Link>
    </nav>
  );
}
