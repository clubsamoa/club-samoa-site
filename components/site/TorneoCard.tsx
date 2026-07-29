import Image from "next/image";
import SocialIcon from "@/components/site/SocialIcon";
import { WHATSAPP_URL } from "@/lib/constants";
import type { Torneo } from "@/content/torneos";

// Tarjeta de torneo, mismo markup que legacy/community.html (.event-card).
export default function TorneoCard({ torneo }: { torneo: Torneo }) {
  return (
    <article className="event-card featured-event-card">
      <Image
        className={`event-poster${torneo.posterLogo ? " event-poster--logo" : ""}`}
        src={torneo.poster}
        alt={torneo.posterAlt}
        width={torneo.posterWidth}
        height={torneo.posterHeight}
        sizes="(max-width: 980px) 100vw, 33vw"
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
          <SocialIcon type="whatsapp" />
          Registro por WhatsApp
        </a>
      )}
    </article>
  );
}
