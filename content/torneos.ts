// Torneos y eventos, extraídos de legacy/community.html (#torneos y
// #eventos-pasados). Agregar/retirar un torneo = editar este archivo.

export type Torneo = {
  fecha: string;
  titulo: string;
  sede: string;
  poster: string;
  posterAlt: string;
  /** Clase extra del póster (ej. logos que no son póster completo). */
  posterLogo?: boolean;
  /** Si es true, muestra el botón de registro por WhatsApp. */
  registroAbierto: boolean;
};

export const TORNEOS_PROXIMOS: Torneo[] = [
  {
    fecha: "6 al 9 de agosto",
    titulo: "Campeonato Nacional de Artes Marciales Mixtas - FAMM",
    sede: "Córdoba, Veracruz.",
    poster: "/images/campeonato-nacional-2026.jpg",
    posterAlt:
      "Poster del Campeonato Nacional de Artes Marciales Mixtas 2026 - Córdoba, Veracruz",
    registroAbierto: true,
  },
  {
    fecha: "16 al 23 de agosto",
    titulo: "Campeonato Mundial Juvenil IMMAF 2026",
    sede: "Abu Dhabi, Emiratos Árabes Unidos.",
    poster: "/images/2026-immaf-youth-world-championships.jpg",
    posterAlt: "Poster del Campeonato Mundial Juvenil IMMAF 2026 - Abu Dhabi",
    registroAbierto: true,
  },
  {
    fecha: "9 al 15 de septiembre",
    titulo: "Campeonato Panamericano IMMAF 2026",
    sede: "Monterrey, México.",
    poster: "/images/2026-immaf-pan-american-championships.jpg",
    posterAlt:
      "Poster del Campeonato Panamericano IMMAF 2026 - Monterrey, México",
    registroAbierto: true,
  },
  {
    fecha: "1 al 7 de noviembre",
    titulo: "Campeonato Mundial IMMAF 2026",
    sede: "Tbilisi, Georgia.",
    poster: "/images/immaf.jpg",
    posterAlt: "Campeonato Mundial IMMAF 2026 - Tbilisi, Georgia",
    posterLogo: true,
    registroAbierto: true,
  },
];

export const TORNEOS_PASADOS: Torneo[] = [
  {
    fecha: "22-24 de Mayo 2026",
    titulo: "Campeonato Regional de Artes Marciales Mixtas 2026",
    sede: "Monclova, Coahuila.",
    poster: "/images/regional2026.jpg",
    posterAlt: "Poster del Campeonato Regional de Artes Marciales Mixtas 2026",
    registroAbierto: false,
  },
  {
    fecha: "2 de Mayo 2026",
    titulo: "Campeonato Estatal de MMA Zona Norte de Tamaulipas",
    sede: "Nuevo Laredo, Tamaulipas - Nueva Ciudad Deportiva.",
    poster: "/images/estatal-znorte2026.jpeg",
    posterAlt: "Poster del Campeonato Estatal de MMA Zona Norte de Tamaulipas",
    registroAbierto: false,
  },
];
