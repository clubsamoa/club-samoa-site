/* eslint-disable @next/next/no-img-element -- paridad 1:1 con legacy; migra a next/image en N07 */
import Nav from "@/components/site/Nav";
import { FACEBOOK_URL, INSTAGRAM_URL, WHATSAPP_URL } from "@/lib/constants";

// Puerto del header compartido de las 3 páginas legacy (index.html:23-91).
export default function Header() {
  return (
    <header className="site-header">
      <div className="brand-lockup">
        <img
          className="brand-logo"
          src="/images/logo-white.png"
          alt="Logo de Club Samoa"
        />
        <div className="brand-wordmark">
          <h1 className="brand-title">CLUB SAMOA</h1>
          <p className="brand-subtitle">ESCUELA DE ARTES MARCIALES</p>
        </div>
      </div>
      <div className="header-right">
        <Nav />
        <div className="header-actions">
          <a
            className="header-social"
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
            className="header-social"
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
          <a
            className="header-cta"
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
            Contáctanos <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </header>
  );
}
