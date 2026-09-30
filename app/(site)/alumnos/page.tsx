import type { Metadata } from "next";
import Image from "next/image";
import RegistroForm from "@/components/site/RegistroForm";
import SocialIcon from "@/components/site/SocialIcon";
import { OG_IMAGE, WHATSAPP_URL } from "@/lib/constants";
import { DISCIPLINAS_UNIFORME, PRODUCTOS, TALLAS } from "@/lib/registros";

export const metadata: Metadata = {
  title: "Club Samoa | Portal de Alumnos",
  description:
    "Portal de alumnos de Club Samoa para uniformes y exámenes de cambio de grado.",
  alternates: { canonical: "/alumnos" },
  openGraph: {
    title: "Club Samoa | Portal de Alumnos",
    description:
      "Pedidos de uniformes e información de exámenes de grado para alumnos de Club Samoa.",
    images: [OG_IMAGE],
  },
};

// Los exámenes ya no se registran por formulario: se pregunta por WhatsApp
// con un mensaje prellenado que el alumno solo completa.
const MENSAJE_EXAMEN = [
  "Hola, Club Samoa. Quiero saber cuándo es el siguiente examen de grado.",
  "Alumno: ",
  "Disciplina (Lima Lama, Kickboxing, MMA o Jiu Jitsu): ",
  "Grado actual: ",
].join("\n");
const WHATSAPP_EXAMENES_URL = `${WHATSAPP_URL}?text=${encodeURIComponent(MENSAJE_EXAMEN)}`;

function CampoNombre({ note }: { note: string }) {
  return (
    <label className="form-field">
      <span className="field-label">
        Nombre del alumno <span className="required-mark">*</span>
      </span>
      <input type="text" name="nombre" placeholder="Nombre completo" required />
      <span className="field-note">{note}</span>
    </label>
  );
}

function CampoWhatsapp({ note }: { note: string }) {
  return (
    <label className="form-field">
      <span className="field-label">
        WhatsApp de contacto <span className="required-mark">*</span>
      </span>
      <input type="tel" name="whatsapp" placeholder="833 000 0000" required />
      <span className="field-note">{note}</span>
    </label>
  );
}

function CampoSelect({
  label,
  name,
  placeholder,
  options,
  note,
}: {
  label: string;
  name: string;
  placeholder: string;
  options: ReadonlyArray<string | { value: string; label: string }>;
  note: string;
}) {
  return (
    <label className="form-field">
      <span className="field-label">
        {label} <span className="required-mark">*</span>
      </span>
      <select name={name} required defaultValue="">
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const text = typeof option === "string" ? option : option.label;
          return (
            <option value={value} key={value}>
              {text}
            </option>
          );
        })}
      </select>
      <span className="field-note">{note}</span>
    </label>
  );
}

function CampoNotas({
  label,
  placeholder,
  note,
}: {
  label: string;
  placeholder: string;
  note: string;
}) {
  return (
    <label className="form-field">
      <span className="field-label">{label}</span>
      <textarea name="notas" rows={4} placeholder={placeholder}></textarea>
      <span className="field-note">{note}</span>
    </label>
  );
}

export default function AlumnosPage() {
  return (
    <main>
      <section className="hero hero-students">
        <div className="hero-copy">
          <p className="eyebrow">Portal de alumnos</p>
          <h2>Gestiona tus pedidos de uniformes y exámenes</h2>
          <p className="hero-text">
            Este espacio está diseñado para alumnos activos del club. Gestiona
            uniformes y participa en exámenes de grado sin interrupciones ni
            procesos externos.
          </p>
          <div className="hero-actions">
            <a
              className="button button-primary button-text-only"
              href="#uniformes"
            >
              Ir a uniformes
            </a>
            <a
              className="button button-secondary button-text-only"
              href="#examenes"
            >
              Ir a exámenes
            </a>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-stat">
            <span className="stat-label">Exámenes Lima Lama</span>
            <strong>
              Se realizan aproximadamente cada 3 meses, según el grado del
              alumno.
            </strong>
          </div>
          <div className="hero-stat">
            <span className="stat-label">Exámenes Kickboxing</span>
            <strong>Se realizan aproximadamente cada 4 meses.</strong>
          </div>
          <div className="hero-stat">
            <span className="stat-label">Exámenes Jiu Jitsu</span>
            <strong>
              Se realizan aproximadamente cada 6 meses, según el grado del
              alumno.
            </strong>
          </div>
          <div className="hero-stat">
            <span className="stat-label">Uniformes</span>
            <strong>Se trabajan únicamente sobre pedido.</strong>
          </div>
        </div>
      </section>

      <section className="dual-layout student-section" id="uniformes">
        <div className="section-heading">
          <h2 className="section-page-title">Uniformes</h2>
          <Image
            className="section-feature-image"
            src="/images/uniformes-2027.png"
            alt="Uniforme 2027 de Club Samoa, frente y espalda"
            width={1280}
            height={800}
            sizes="(max-width: 980px) 100vw, 45vw"
            style={{ height: "auto" }}
          />
          <h3>Realiza tu pedido fácil</h3>
          <p>
            Completa el formulario y tu pedido quedará guardado en la base de
            uniformes.
          </p>
        </div>
        <RegistroForm
          variant="uniforme"
          submitLabel="Enviar pedido"
          confirmationEyebrow="Pedido recibido"
          confirmationTitle="Se ha guardado correctamente tu pedido"
        >
          <CampoNombre note="Usa el nombre del alumno tal como aparece en clase." />
          <CampoWhatsapp note="Usaremos este número solo para confirmar el pedido." />
          <CampoSelect
            label="Disciplina"
            name="disciplina"
            placeholder="Selecciona una opción"
            options={DISCIPLINAS_UNIFORME}
            note="Indica la disciplina principal del alumno."
          />
          <label className="form-field">
            <span className="field-label">
              Producto <span className="required-mark">*</span>
            </span>
            <span
              className="checkbox-list"
              role="group"
              aria-label="Producto"
              data-required-checkbox-group
            >
              {PRODUCTOS.map((producto) => (
                <label className="checkbox-option" key={producto}>
                  <input type="checkbox" name="producto" value={producto} />
                  <span>{producto}</span>
                </label>
              ))}
            </span>
            <span className="field-note">
              Selecciona uno o varios productos para este pedido.
            </span>
          </label>
          <CampoSelect
            label="Talla"
            name="talla"
            placeholder="Selecciona una talla"
            options={TALLAS}
            note="Selecciona la talla del uniforme que necesitas pedir."
          />
          <label className="form-field">
            <span className="field-label">
              Cantidad <span className="required-mark">*</span>
            </span>
            <input
              type="number"
              name="cantidad"
              min={1}
              defaultValue={1}
              required
            />
            <span className="field-note">
              Puedes pedir una o varias piezas en la misma solicitud.
            </span>
          </label>
          <CampoNotas
            label="Notas"
            placeholder="Color, cinturón, fecha deseada o comentario extra"
            note="Campo opcional para detalles extra del pedido."
          />
        </RegistroForm>
      </section>

      <section className="dual-layout student-section" id="examenes">
        <div className="section-heading">
          <h2 className="section-page-title">Exámenes de grado</h2>
          <Image
            className="section-feature-image"
            src="/images/examen26.jpg"
            alt="Exámenes de grado para alumnos Club Samoa"
            width={1440}
            height={1141}
            sizes="(max-width: 980px) 100vw, 45vw"
            style={{ height: "auto" }}
          />
          <h3>Pregunta por el siguiente examen.</h3>
          <p>
            Las fechas de examen de Lima Lama, Kickboxing, MMA y Jiu Jitsu se
            confirman directamente con el club, según la disciplina y el grado
            de cada alumno.
          </p>
        </div>
        <article className="data-form examen-contacto">
          <p className="eyebrow">Exámenes</p>
          <h3>¿Cuándo es el siguiente examen?</h3>
          <p>
            Escríbenos por WhatsApp. El mensaje ya va escrito: solo completa tu
            nombre, tu disciplina y tu grado actual, y te confirmamos la fecha
            por ese mismo medio.
          </p>
          <a
            className="button button-primary"
            href={WHATSAPP_EXAMENES_URL}
            target="_blank"
            rel="noreferrer"
          >
            <SocialIcon type="whatsapp" />
            Preguntar por WhatsApp
          </a>
        </article>
      </section>
    </main>
  );
}
