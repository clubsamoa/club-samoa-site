/* eslint-disable @next/next/no-img-element -- paridad 1:1 con legacy; migra a next/image en N07 */
import ScheduleTimeline from "@/components/site/ScheduleTimeline";
import {
  FACEBOOK_URL,
  INSTAGRAM_URL,
  MAPS_URL,
  WHATSAPP_URL,
} from "@/lib/constants";

// Puerto de legacy/index.html:93-333 — hero, legado, horarios y contacto.
export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Desde 1983</p>
          <h2>
            Más de cuatro décadas impulsando campeones con disciplina, respeto y
            experiencia en Tamaulipas.
          </h2>
          <p className="hero-text">
            Donde se forma algo más que peleadores. Clases organizadas para
            avanzar con método y propósito. Aquí construyes técnica, disciplina
            y respeto.
          </p>
          <div className="hero-actions">
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
              Contáctanos por WhatsApp
            </a>
            <a
              className="button button-secondary"
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
            >
              <img
                className="social-icon"
                src="/icon-instagram.png"
                alt=""
                aria-hidden="true"
              />
              Instagram
            </a>
            <a
              className="button button-secondary"
              href={FACEBOOK_URL}
              target="_blank"
              rel="noreferrer"
            >
              <img
                className="social-icon"
                src="/icon-facebook.png"
                alt=""
                aria-hidden="true"
              />
              Facebook
            </a>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-logo-wrap">
            <img
              className="hero-logo hero-photo"
              src="/images/valeria.jpg"
              alt="Valeria entrenando en Club Samoa"
            />
          </div>
          <div className="hero-stat">
            <span className="stat-label">Legado</span>
            <strong>Desde 1983 en Tamaulipas</strong>
          </div>
          <div className="hero-stat">
            <span className="stat-label">Edades</span>
            <strong>Niños, jóvenes y adultos</strong>
          </div>
          <div className="hero-stat">
            <span className="stat-label">Disciplinas</span>
            <strong>Lima lama, Kickboxing, MMA, Muay Thai y Jiu Jitsu</strong>
          </div>
        </div>
      </section>

      <section className="legacy-band" aria-label="Legado Club Samoa">
        <div className="legacy-copy">
          <p className="eyebrow">Formación marcial</p>
          <h3>Una academia con historia, estructura y presencia.</h3>
          <p>
            Progreso real, clase a clase. Entrena con estructura clara y
            objetivos definidos. Técnica, condición y disciplina en cada sesión.
          </p>
        </div>
        <div className="legacy-quote">
          <p className="eyebrow">Ubicación</p>
          <p>Club Samoa Madero</p>
          <strong>
            Allende #300 Sur, esquina con Francisco Sarabia, Zona Centro, Ciudad
            Madero
          </strong>
        </div>
      </section>

      <section className="section-grid" id="horarios">
        <div className="section-heading">
          <p className="eyebrow">Horarios</p>
          <h3>Elige tu disciplina y encuentra tu bloque ideal.</h3>
          <p>
            Agrupamos las clases por días y disciplina para que alumnos y
            familias identifiquen rápido el horario que mejor les funciona.
          </p>
          <img
            className="section-feature-image schedule-feature-image"
            src="/images/class.jpeg"
            alt="Clases en Club Samoa"
          />
          <div className="schedule-image-cta">
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
              Agenda tu clase muestra
            </a>
          </div>
        </div>
        <div className="schedule-panel">
          <ScheduleTimeline />
        </div>
      </section>

      <section className="contact-section" id="contacto">
        <div className="section-heading">
          <p className="eyebrow">Contacto</p>
          <h3>Entrena con nosotros.</h3>
          <p>
            Escríbenos por WhatsApp o visita nuestro Instagram para conocer el
            ambiente, los avances y las novedades de Club Samoa.
          </p>
        </div>
        <div className="contact-actions">
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
            Escribir por WhatsApp
          </a>
          <a
            className="button button-secondary"
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
          >
            <img
              className="social-icon"
              src="/icon-instagram.png"
              alt=""
              aria-hidden="true"
            />
            Ir a Instagram
          </a>
          <a
            className="button button-secondary"
            href={FACEBOOK_URL}
            target="_blank"
            rel="noreferrer"
          >
            <img
              className="social-icon"
              src="/icon-facebook.png"
              alt=""
              aria-hidden="true"
            />
            Ir a Facebook
          </a>
        </div>
        <a
          className="contact-map"
          href={MAPS_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Open Club Samoa map in Google Maps"
        >
          <span className="contact-map-grid" aria-hidden="true"></span>
          <span
            className="contact-map-road contact-map-road-horizontal road-main-top"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-road contact-map-road-horizontal road-main-bottom"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-road contact-map-road-vertical road-main-left"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-road contact-map-road-vertical road-main-right"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-road contact-map-road-horizontal road-small-top"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-road contact-map-road-horizontal road-small-middle"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-road contact-map-road-horizontal road-small-bottom"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-road contact-map-road-vertical road-small-left"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-road contact-map-road-vertical road-small-midleft"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-road contact-map-road-vertical road-small-midright"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-road contact-map-road-vertical road-small-right"
            aria-hidden="true"
          ></span>

          <span
            className="contact-map-building building-one"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-building building-two"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-building building-three"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-building building-four"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-building building-five"
            aria-hidden="true"
          ></span>
          <span
            className="contact-map-building building-six"
            aria-hidden="true"
          ></span>

          <span className="contact-map-overlay" aria-hidden="true"></span>
          <span className="contact-map-badge">
            <span className="contact-map-badge-dot" aria-hidden="true"></span>
            LIVE
          </span>
          <span className="contact-map-pin" aria-hidden="true">
            <span className="contact-map-pin-center"></span>
          </span>

          <span className="contact-map-copy">
            <span className="contact-map-label">Map</span>
            <strong>Club Samoa, Ciudad Madero</strong>
            <span>Allende #300 Sur, esquina con Francisco Sarabia</span>
            <span>Zona Centro, Ciudad Madero, Tamaulipas</span>
          </span>
        </a>
      </section>
    </main>
  );
}
