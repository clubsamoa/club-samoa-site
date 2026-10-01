"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useModalFocus from "@/components/admin/useModalFocus";
import SocialIcon from "@/components/site/SocialIcon";
import { ANUNCIO_TORNEO } from "@/content/torneos";
import { WHATSAPP_URL } from "@/lib/constants";
import { hoyEnZonaClub } from "@/lib/fechas";

// Boleto de bienvenida con el torneo de aniversario. Sale al abrir cualquier
// página del sitio público, una vez al día por navegador, y se deja de mostrar
// solo cuando pasa la fecha del torneo (content/torneos.ts).
//
// No se renderiza en el servidor: se monta tras un respiro para no tapar la
// página en el primer vistazo ni mover nada mientras carga.

const RETRASO_MS = 900;

const MENSAJE = [
  "Hola, Club Samoa. Quiero información del Campeonato Abierto de Artes Marciales del 24 de octubre.",
  "Nombre: ",
  "Disciplina: ",
].join("\n");
const WHATSAPP_TORNEO_URL = `${WHATSAPP_URL}?text=${encodeURIComponent(MENSAJE)}`;

function claveDelDia(id: string) {
  return `samoa:anuncio:${id}`;
}

/** El visitante ya lo cerró hoy. localStorage puede fallar (modo privado). */
function yaVistoHoy(id: string, hoy: string): boolean {
  try {
    return window.localStorage.getItem(claveDelDia(id)) === hoy;
  } catch {
    return false;
  }
}

function recordarVisto(id: string, hoy: string) {
  try {
    window.localStorage.setItem(claveDelDia(id), hoy);
  } catch {
    // Sin almacenamiento solo significa que volverá a salir: no es un error.
  }
}

export default function AnuncioTorneo() {
  const [abierto, setAbierto] = useState(false);
  const dialogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ANUNCIO_TORNEO) return;
    const hoy = hoyEnZonaClub();
    if (hoy > ANUNCIO_TORNEO.hasta) return;
    if (yaVistoHoy(ANUNCIO_TORNEO.id, hoy)) return;
    const temporizador = window.setTimeout(() => setAbierto(true), RETRASO_MS);
    return () => window.clearTimeout(temporizador);
  }, []);

  const cerrar = useCallback(() => {
    setAbierto(false);
    if (ANUNCIO_TORNEO) recordarVisto(ANUNCIO_TORNEO.id, hoyEnZonaClub());
  }, []);

  if (!ANUNCIO_TORNEO || !abierto) return null;

  return (
    <Dialogo anuncio={ANUNCIO_TORNEO} cerrar={cerrar} dialogoRef={dialogoRef} />
  );
}

function Dialogo({
  anuncio,
  cerrar,
  dialogoRef,
}: {
  anuncio: NonNullable<typeof ANUNCIO_TORNEO>;
  cerrar: () => void;
  dialogoRef: React.RefObject<HTMLDivElement | null>;
}) {
  useModalFocus(dialogoRef, cerrar);

  return (
    <div
      className="anuncio-fondo"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) cerrar();
      }}
    >
      <div
        className="anuncio-dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anuncio-titulo"
        ref={dialogoRef}
      >
        <button
          type="button"
          className="anuncio-cerrar"
          onClick={cerrar}
          aria-label="Cerrar el anuncio del torneo"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="boleto">
          <div className="boleto-grano" aria-hidden="true" />
          <div className="boleto-perforacion" aria-hidden="true" />

          <div className="boleto-cuerpo">
            <p className="boleto-eyebrow">
              {anuncio.eyebrow}
              <br />
              {anuncio.evento}
            </p>
            <p className="boleto-titulo" id="anuncio-titulo">
              {anuncio.titulo.map((linea) => (
                <span key={linea}>{linea}</span>
              ))}
            </p>
            <p className="boleto-pie">
              {anuncio.sede} · {anuncio.marca}
            </p>
          </div>

          <div className="boleto-talon" aria-hidden="true">
            <span className="boleto-marca">{anuncio.marca}</span>
            <span className="boleto-talon-texto">{anuncio.talon}</span>
          </div>
        </div>

        <p className="anuncio-detalle">{anuncio.detalle}</p>

        <div className="anuncio-acciones">
          <a
            className="button button-primary"
            href={WHATSAPP_TORNEO_URL}
            target="_blank"
            rel="noreferrer"
            onClick={cerrar}
          >
            <SocialIcon type="whatsapp" />
            Registro por WhatsApp
          </a>
          <a
            className="button button-secondary"
            href={anuncio.href}
            onClick={cerrar}
          >
            Ver el torneo
          </a>
        </div>
      </div>
    </div>
  );
}
