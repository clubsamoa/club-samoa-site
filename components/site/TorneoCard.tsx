/* eslint-disable @next/next/no-img-element -- paridad 1:1 con legacy; migra a next/image en N07 */
import { WHATSAPP_URL } from "@/lib/constants";
import type { Torneo } from "@/content/torneos";

// Tarjeta de torneo, mismo markup que legacy/community.html (.event-card).
export default function TorneoCard({ torneo }: { torneo: Torneo }) {
  return (
    <article className="event-card featured-event-card">
      <img
        className={`event-poster${torneo.posterLogo ? " event-poster--logo" : ""}`}
        src={torneo.poster}
        alt={torneo.posterAlt}
      />
      <div className="event-copy">
        <p className="event-date">{torneo.fecha}</p>
        <h4>{torneo.titulo}</h4>
        <p>{torneo.sede}</p>
      </div>
      {torneo.registroAbierto && (
        <a
          className="button button-primary"
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
        >
          <img
            className="social-icon"
            src="/icon-whatsapp.png"
            alt=""
            aria-hidden="true"
          />
          Registro por WhatsApp
        </a>
      )}
    </article>
  );
}
