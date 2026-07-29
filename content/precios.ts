// Precios y paquetes, extraídos de legacy/community.html (sección #precios).
// Actualizar precios = editar este archivo, no JSX.

export type PlanPrecio = {
  tag: string;
  titulo: string;
  precio: string;
  descripcion: string;
  cta: { label: string; estilo: "primary" | "secondary" };
  notaPrevia?: string;
  beneficios: string[];
  destacado?: boolean;
};

export const PLANES: PlanPrecio[] = [
  {
    tag: "Mensual",
    titulo: "1 Disciplina",
    precio: "$600 MXN",
    descripcion:
      "Ideal para alumnos que quieren enfocarse en una sola disciplina.",
    cta: { label: "Solicitar lugar", estilo: "secondary" },
    beneficios: [
      "Acceso a una disciplina",
      "Horario asignado según grupo",
      "Seguimiento por WhatsApp e Instagram",
      "Clase muestra gratis en la academia",
    ],
  },
  {
    tag: "Full Access",
    titulo: "Acceso completo",
    precio: "$800 MXN",
    descripcion:
      "Para quienes quieren aprovechar al máximo el entrenamiento en Club Samoa.",
    cta: { label: "Contáctanos ahora", estilo: "primary" },
    notaPrevia: "Todo lo de 1 disciplina, más:",
    beneficios: [
      "Acceso a todas las disciplinas",
      "Ideal para alumnos con enfoque competitivo",
      "Mayor flexibilidad de entrenamiento",
      "Mejor combinación entre técnica y condición",
      "Ruta más fuerte para quienes buscan evolución completa",
    ],
    destacado: true,
  },
];

export const INSCRIPCION = {
  tag: "Ingreso",
  titulo: "Inscripción",
  precio: "$450 MXN",
  descripcion: "Pago único para alta del alumno. La clase muestra es gratis.",
  nota: "Nota: la inscripción se cubre una sola vez al iniciar el proceso del alumno.",
};
