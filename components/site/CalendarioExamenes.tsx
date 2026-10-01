"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DISCIPLINAS_SIN_MES_FIJO, MESES_VISIBLES } from "@/content/examenes";
import {
  capitalizar,
  disciplinasDelMes,
  etiquetaMes,
  hayExamen,
  listaEnEspanol,
  mesActual,
  mesesDesde,
  mismoMes,
  nombreMesCorto,
  proximoMesConExamen,
  type MesCalendario,
} from "@/lib/examenes";

// Calendario de exámenes por mes (no por día: el club confirma el día exacto
// por WhatsApp). La tira arranca siempre en el mes en curso y avanza un año.
//
// `mesInicial` lo calcula el servidor para que el HTML y la hidratación
// coincidan; una vez hidratado, useSyncExternalStore cambia al mes real del
// navegador, porque la página es estática y su HTML se genera en el deploy.

type Props = {
  mesInicial: MesCalendario;
  children?: React.ReactNode;
};

// El mes del navegador no cambia mientras la página está abierta, así que la
// suscripción no tiene nada que escuchar; el snapshot se cachea para devolver
// siempre la misma referencia.
const sinSuscripcion = () => () => {};
let mesDelNavegador: MesCalendario | null = null;
function leerMesDelNavegador(): MesCalendario {
  mesDelNavegador ??= mesActual();
  return mesDelNavegador;
}

export default function CalendarioExamenes({ mesInicial, children }: Props) {
  const mesBase = useSyncExternalStore(
    sinSuscripcion,
    leerMesDelNavegador,
    () => mesInicial,
  );
  const [indice, setIndice] = useState(0);
  const seleccionRef = useRef<HTMLButtonElement>(null);
  const interaccionRef = useRef(false);

  const meses = useMemo(() => mesesDesde(mesBase, MESES_VISIBLES), [mesBase]);
  const seleccionado = meses[indice] ?? mesBase;
  const disciplinas = disciplinasDelMes(seleccionado.mes);
  const siguiente = proximoMesConExamen(seleccionado, false);

  // Solo centra la tira cuando el cambio vino de un clic o de las flechas, no
  // al cargar: así la página no salta al abrirse.
  useEffect(() => {
    if (!interaccionRef.current) return;
    seleccionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [indice]);

  const irA = (nuevoIndice: number) => {
    interaccionRef.current = true;
    setIndice(Math.min(Math.max(nuevoIndice, 0), meses.length - 1));
  };

  const irAlMes = (destino: MesCalendario) => {
    const posicion = meses.findIndex((mes) => mismoMes(mes, destino));
    if (posicion >= 0) irA(posicion);
  };

  return (
    <article className="data-form examen-calendario">
      <p className="eyebrow">Exámenes de grado</p>

      <div className="calendario-cabecera">
        <p className="calendario-mes-actual">
          {capitalizar(etiquetaMes(seleccionado))}
        </p>
        <div className="calendario-flechas">
          <button
            type="button"
            onClick={() => irA(indice - 1)}
            disabled={indice === 0}
            aria-label="Mes anterior"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={() => irA(indice + 1)}
            disabled={indice === meses.length - 1}
            aria-label="Mes siguiente"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      <div className="calendario-meses" role="group" aria-label="Meses del año">
        {meses.map((mes, posicion) => {
          const activo = posicion === indice;
          const conExamen = hayExamen(mes.mes);
          return (
            <button
              type="button"
              key={`${mes.anio}-${mes.mes}`}
              ref={activo ? seleccionRef : null}
              className={`calendario-mes${activo ? " is-activa" : ""}${
                conExamen ? " con-examen" : ""
              }`}
              aria-pressed={activo}
              aria-label={`${capitalizar(etiquetaMes(mes))}${
                conExamen ? ", con examen" : ", sin examen"
              }`}
              onClick={() => irA(posicion)}
            >
              <span aria-hidden="true">{nombreMesCorto(mes.mes)}</span>
              {conExamen ? (
                <span className="calendario-punto" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="calendario-detalle" aria-live="polite">
        {disciplinas.length > 0 ? (
          <>
            <h3>Hay examen en {etiquetaMes(seleccionado)}</h3>
            <ul className="calendario-disciplinas">
              {disciplinas.map((nombre) => (
                <li key={nombre}>{nombre}</li>
              ))}
            </ul>
            <p className="calendario-nota">
              El día y la hora se confirman por WhatsApp, según tu grado.
            </p>
          </>
        ) : (
          <>
            <h3>Sin examen en {etiquetaMes(seleccionado)}</h3>
            {siguiente ? (
              <p className="calendario-nota">
                El siguiente es en {etiquetaMes(siguiente)}:{" "}
                {listaEnEspanol(disciplinasDelMes(siguiente.mes))}.{" "}
                <button
                  type="button"
                  className="calendario-salto"
                  onClick={() => irAlMes(siguiente)}
                >
                  Ver {nombreMesCorto(siguiente.mes).toLowerCase()}
                </button>
              </p>
            ) : null}
          </>
        )}
      </div>

      <p className="calendario-cadencias">
        {listaEnEspanol(DISCIPLINAS_SIN_MES_FIJO)} no entra en el calendario: no
        tiene mes fijo y la fecha se confirma por WhatsApp.
      </p>

      {children}
    </article>
  );
}
