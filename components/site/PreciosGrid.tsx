import SocialIcon from "@/components/site/SocialIcon";
import { INSCRIPCION, PLANES } from "@/content/precios";
import { WHATSAPP_URL } from "@/lib/constants";

// Tarjetas de precios, mismo markup que legacy/community.html (.pricing-shell).
export default function PreciosGrid() {
  return (
    <div className="pricing-shell">
      <div className="pricing-grid pricing-grid-compare">
        {PLANES.map((plan) => (
          <article
            className={`pricing-card ${
              plan.destacado ? "pricing-card-highlight" : "pricing-card-base"
            }`}
            key={plan.titulo}
          >
            <div className="pricing-top">
              <p className="price-tag">{plan.tag}</p>
              <h4>{plan.titulo}</h4>
              <p className="price">{plan.precio}</p>
              <p className="pricing-description">{plan.descripcion}</p>
              <a
                className={`button button-${plan.cta.estilo} pricing-button`}
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
              >
                <SocialIcon type="whatsapp" />
                {plan.cta.label}
              </a>
            </div>
            {plan.notaPrevia && (
              <div className="pricing-plus">{plan.notaPrevia}</div>
            )}
            <ul>
              {plan.beneficios.map((beneficio) => (
                <li key={beneficio}>
                  <span className="check-mark">✓</span> {beneficio}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <article className="pricing-card pricing-card-footer">
        <div className="pricing-footer-copy">
          <p className="price-tag">{INSCRIPCION.tag}</p>
          <h4>{INSCRIPCION.titulo}</h4>
          <p className="price">{INSCRIPCION.precio}</p>
          <p className="pricing-description">{INSCRIPCION.descripcion}</p>
        </div>
        <p className="pricing-note">{INSCRIPCION.nota}</p>
      </article>
    </div>
  );
}
