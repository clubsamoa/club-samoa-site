import type { Metadata } from "next";
import Footer from "@/components/site/Footer";
import PreciosGrid from "@/components/site/PreciosGrid";
import TorneoCard from "@/components/site/TorneoCard";
import { TORNEOS_PASADOS, TORNEOS_PROXIMOS } from "@/content/torneos";

export const metadata: Metadata = {
  title: "Club Samoa | Comunidad",
  description:
    "Precios, paquetes y torneos de Club Samoa para la comunidad de alumnos y competidores.",
  alternates: { canonical: "/comunidad" },
  openGraph: {
    title: "Club Samoa | Comunidad",
    description:
      "Precios, paquetes y torneos de Club Samoa para la comunidad de alumnos y competidores.",
  },
};

// Puerto de legacy/community.html — precios, torneos y eventos pasados.
export default function ComunidadPage() {
  return (
    <>
      <main>
        <section className="hero hero-students">
          <div className="hero-copy">
            <p className="eyebrow">Comunidad Club Samoa</p>
            <h2>Precios, paquetes y torneos en un solo espacio.</h2>
            <p className="hero-text">
              Esta página reúne la información de costos y los eventos
              competitivos para mantenerla en un espacio más privado y fácil de
              consultar.
            </p>
            <div className="hero-actions">
              <a
                className="button button-primary button-text-only"
                href="#precios"
              >
                Ir a precios
              </a>
              <a
                className="button button-secondary button-text-only"
                href="#torneos"
              >
                Ir a torneos
              </a>
            </div>
          </div>
          <div className="hero-panel">
            <div className="hero-stat">
              <span className="stat-label">Acceso</span>
              <strong>
                Información reunida para alumnos y comunidad competitiva.
              </strong>
            </div>
            <div className="hero-stat">
              <span className="stat-label">Precios</span>
              <strong>Mensualidades, acceso completo e inscripción.</strong>
            </div>
            <div className="hero-stat">
              <span className="stat-label">Torneos</span>
              <strong>
                Convocatorias activas y registro para próximos eventos.
              </strong>
            </div>
          </div>
        </section>

        <section className="section-stack" id="precios">
          <div className="section-heading pricing-heading">
            <p className="eyebrow">Precios y Paquetes</p>
            <h3>Inscripción simple y clase muestra gratis.</h3>
            <p>
              Elige una disciplina o entrena con acceso completo. La academia
              mantiene un esquema claro para nuevos ingresos y alumnos activos.
            </p>
          </div>
          <PreciosGrid />
        </section>

        <section className="section-stack" id="torneos">
          <div className="section-heading">
            <p className="eyebrow">Próximos torneos</p>
            <h3>Eventos destacados para la comunidad competitiva.</h3>
          </div>
          <div className="events-list">
            {TORNEOS_PROXIMOS.map((torneo) => (
              <TorneoCard torneo={torneo} key={torneo.titulo} />
            ))}
          </div>
        </section>

        <section className="section-stack" id="eventos-pasados">
          <div className="section-heading">
            <p className="eyebrow">Eventos pasados</p>
            <h3>Torneos recientes en los que participamos.</h3>
          </div>
          <div className="events-list">
            {TORNEOS_PASADOS.map((torneo) => (
              <TorneoCard torneo={torneo} key={torneo.titulo} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
