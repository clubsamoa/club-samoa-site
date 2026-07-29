// Horarios de clases, extraídos del markup de legacy/index.html (sección
// #horarios). Actualizar horarios = editar este archivo, no JSX.

export type BloqueHorario = {
  inicio: string;
  fin: string;
  nota?: string;
};

export type GrupoDisciplina = {
  disciplina: string;
  bloques: BloqueHorario[];
};

export type BloqueDias = {
  dias: string;
  grupos: GrupoDisciplina[];
};

export const HORARIOS: BloqueDias[] = [
  {
    dias: "Lunes, Miércoles y Viernes",
    grupos: [
      {
        disciplina: "KICKBOXING",
        bloques: [{ inicio: "09:00 am", fin: "10:00 am" }],
      },
      {
        disciplina: "LIMA LAMA KIDS",
        bloques: [
          { inicio: "5:00 pm", fin: "6:00 pm" },
          { inicio: "6:00 pm", fin: "7:00 pm" },
        ],
      },
      {
        disciplina: "MUAY THAI",
        bloques: [{ inicio: "7:00 pm", fin: "8:00 pm" }],
      },
      {
        disciplina: "MMA",
        bloques: [{ inicio: "8:00 pm", fin: "9:00 pm" }],
      },
    ],
  },
  {
    dias: "Martes y Jueves",
    grupos: [
      {
        disciplina: "JIU JITSU",
        bloques: [{ inicio: "09:00 am", fin: "10:00 am" }],
      },
      {
        disciplina: "MMA KIDS",
        bloques: [{ inicio: "5:00 pm", fin: "6:00 pm" }],
      },
      {
        disciplina: "KICKBOXING",
        bloques: [
          { inicio: "6:00 pm", fin: "7:00 pm", nota: "Niños" },
          { inicio: "7:00 pm", fin: "8:00 pm", nota: "Jóvenes y adultos" },
        ],
      },
      {
        disciplina: "JIU JITSU",
        bloques: [{ inicio: "8:00 pm", fin: "9:00 pm" }],
      },
    ],
  },
];
