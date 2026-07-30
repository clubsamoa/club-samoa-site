"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import EventosActivosNav from "@/components/admin/EventosActivosNav";

// Puerto de buildSidebar/buildNav de legacy/admin/js/shell.js:140-260.
// El item activo se deriva de la ruta (usePathname) en vez del data-section
// que cada HTML declaraba a mano.

const NAV_ITEMS = [
  { key: "eventos", label: "Eventos", icon: "🥊", href: "/admin/eventos" },
  { key: "atletas", label: "Atletas", icon: "👥", href: "/admin/atletas" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-section">Principal</div>
      <nav className="admin-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              data-section={item.key}
              className={isActive ? "is-active" : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="admin-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-section">Eventos activos</div>
      <EventosActivosNav />
    </aside>
  );
}
