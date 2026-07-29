import Image from "next/image";
import Nav from "@/components/site/Nav";
import SocialIcon from "@/components/site/SocialIcon";
import { FACEBOOK_URL, INSTAGRAM_URL, WHATSAPP_URL } from "@/lib/constants";

// Puerto del header compartido de las 3 páginas legacy (index.html:23-91).
export default function Header() {
  return (
    <header className="site-header">
      <div className="brand-lockup">
        <Image
          className="brand-logo"
          src="/images/logo-white.png"
          alt="Logo de Club Samoa"
          width={480}
          height={600}
          priority
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
            <SocialIcon type="instagram" />
            Instagram
          </a>
          <a
            className="header-social"
            href={FACEBOOK_URL}
            target="_blank"
            rel="noreferrer"
          >
            <SocialIcon type="facebook" />
            Facebook
          </a>
          <a
            className="header-cta"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
          >
            <SocialIcon type="whatsapp" />
            Contáctanos <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </header>
  );
}
