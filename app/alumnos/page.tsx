import type { Metadata } from "next";
import Image from "next/image";
import RegistroForm from "@/components/site/RegistroForm";
import {
  DISCIPLINAS_EXAMEN_LIMA_KICK,
  DISCIPLINAS_EXAMEN_MMA_JJ,
  DISCIPLINAS_UNIFORME,
  FECHAS_LIMA_KICK,
  FECHAS_MMA_JJ,
  PRODUCTOS,
  TALLAS,
} from "@/lib/registros";

export const metadata: Metadata = {
  title: "Club Samoa | Portal de Alumnos",
  description:
    "Portal de alumnos de Club Samoa para uniformes y exámenes de cambio de grado.",
  alternates: { canonical: "/alumnos" },
  openGraph: {
    title: "Club Samoa | Portal de Alumnos",
    description:
      "Pedidos de uniformes y registro de exámenes de grado para alumnos de Club Samoa.",
  },
};

const REGISTRO_GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSegmOny29CU4m2uuKxoblRP3gCX8T9Mrm-V_pmnuqCLhOhK5w/viewform";

// Los grados con "Cafe" guardan el valor sin acento (así los espera la Sheet,
// ver legacy/students.html:306-308) pero se muestran con acento.
const GRADOS_LIMA_KICK_OPTIONS = [
  { value: "Cinta Naranja", label: "Cinta Naranja" },
  { value: "Cinta Morada", label: "Cinta Morada" },
  { value: "Cinta Azul", label: "Cinta Azul" },
  { value: "Cinta Verde", label: "Cinta Verde" },
  { value: "Cinta Cafe I", label: "Cinta Café I" },
  { value: "Cinta Cafe II", label: "Cinta Café II" },
  { value: "Cinta Cafe III", label: "Cinta Café III" },
  { value: "Cinta Negra", label: "Cinta Negra" },
];

const GRADOS_MMA_JJ_OPTIONS = [
  { value: "Blanca", label: "Blanca" },
  { value: "Azul", label: "Azul" },
  { value: "Morada", label: "Morada" },
  { value: "Cafe", label: "Café" },
];

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
          <div className="hero-registration">
            <p className="hero-registration-copy">
              ¿Ya te registraste? Completa tu registro aquí.
            </p>
            <a
              className="button button-primary hero-registration-button"
              href={REGISTRO_GOOGLE_FORM_URL}
              target="_blank"
              rel="noreferrer"
            >
              Completar registro
            </a>
            <p className="hero-registration-note">
              Si ya hiciste tu registro NO es necesario que lo vuelvas a hacer
            </p>
          </div>
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
            src="/images/uniformes-no.jpg"
            alt="Uniformes disponibles para alumnos Club Samoa"
            width={940}
            height={788}
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
          <h2 className="section-page-title">
            Exámenes de Lima Lama y Kickboxing
          </h2>
          <Image
            className="section-feature-image"
            src="/images/examen26.jpg"
            alt="Exámenes de grado para alumnos Club Samoa"
            width={1440}
            height={1141}
            sizes="(max-width: 980px) 100vw, 45vw"
            style={{ height: "auto" }}
          />
          <h3>Registro rápido para cambio de grado.</h3>
          <p>
            Si eres alumno actual, utiliza este formulario para guardar tu
            solicitud de cambio de grado.
          </p>
        </div>
        <RegistroForm
          variant="examen-lima-kick"
          submitLabel="Enviar registro"
          confirmationEyebrow="Registro recibido"
          confirmationTitle="Se ha guardado correctamente tu registro"
        >
          <CampoNombre note="Escribe el nombre completo del alumno que presentará el examen." />
          <CampoWhatsapp note="Usaremos este número solo para confirmar detalles del examen." />
          <CampoSelect
            label="Disciplina"
            name="disciplina"
            placeholder="Selecciona una opción"
            options={DISCIPLINAS_EXAMEN_LIMA_KICK}
            note="Selecciona la disciplina del examen."
          />
          <CampoSelect
            label="Grado actual"
            name="grado"
            placeholder="Selecciona una opción"
            options={GRADOS_LIMA_KICK_OPTIONS}
            note="Indica el grado o cinta actual para validar el registro."
          />
          <CampoSelect
            label="Próximo examen"
            name="fecha"
            placeholder="Selecciona una opción"
            options={FECHAS_LIMA_KICK}
            note="Selecciona la fecha programada para el cambio de grado."
          />
          <CampoNotas
            label="Observaciones"
            placeholder="Duda, comprobante pendiente o comentario"
            note="Campo opcional para dudas, pagos o comentarios."
          />
        </RegistroForm>
      </section>

      <section
        className="dual-layout student-section"
        id="examenes-mma-jiujitsu"
      >
        <div className="section-heading">
          <h2 className="section-page-title">Exámenes de MMA &amp; JiuJitsu</h2>
          <Image
            className="section-feature-image"
            src="/images/bjj.jpg"
            alt="Exámenes de MMA y Jiu Jitsu para alumnos Club Samoa"
            width={1440}
            height={1080}
            sizes="(max-width: 980px) 100vw, 45vw"
            style={{ height: "auto" }}
          />
          <h3>Registro rápido para cambio de grado.</h3>
          <p>
            Si eres alumno actual de MMA o Jiu Jitsu, utiliza este formulario
            para guardar tu solicitud de cambio de grado.
          </p>
        </div>
        <RegistroForm
          variant="examen-mma-jj"
          submitLabel="Enviar registro"
          confirmationEyebrow="Registro recibido"
          confirmationTitle="Se ha guardado correctamente tu registro"
        >
          <CampoNombre note="Escribe el nombre completo del alumno que presentará el examen." />
          <CampoWhatsapp note="Usaremos este número solo para confirmar detalles del examen." />
          <CampoSelect
            label="Disciplina"
            name="disciplina"
            placeholder="Selecciona una opción"
            options={DISCIPLINAS_EXAMEN_MMA_JJ}
            note="Selecciona la disciplina del examen."
          />
          <CampoSelect
            label="Grado actual"
            name="grado"
            placeholder="Selecciona una opción"
            options={GRADOS_MMA_JJ_OPTIONS}
            note="Indica el grado o cinta actual para validar el registro."
          />
          <CampoSelect
            label="Próximo examen"
            name="fecha"
            placeholder="Selecciona una opción"
            options={FECHAS_MMA_JJ}
            note="Selecciona la fecha programada para el cambio de grado."
          />
          <CampoNotas
            label="Observaciones"
            placeholder="Duda, comprobante pendiente o comentario"
            note="Campo opcional para dudas, pagos o comentarios."
          />
        </RegistroForm>
      </section>
    </main>
  );
}
