import { HORARIOS } from "@/content/horarios";

// Timeline de horarios, mismo markup que legacy/index.html:186-253.
export default function ScheduleTimeline() {
  return (
    <div className="schedule-timeline" aria-label="Horarios por grupo de días">
      {HORARIOS.map((bloque) => (
        <article className="schedule-event" key={bloque.dias}>
          <div className="schedule-node" aria-hidden="true"></div>
          <div className="schedule-card">
            <p className="schedule-days">{bloque.dias}</p>
            <div className="schedule-groups">
              {bloque.grupos.map((grupo, index) => (
                <section
                  className="schedule-group"
                  key={`${grupo.disciplina}-${index}`}
                >
                  <h4>{grupo.disciplina}</h4>
                  <ul>
                    {grupo.bloques.map((horario) => (
                      <li key={`${horario.inicio}-${horario.fin}`}>
                        {horario.inicio} - {horario.fin}
                        {horario.nota ? ` (${horario.nota})` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
