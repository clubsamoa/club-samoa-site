// Torneos y eventos, extraídos de legacy/community.html (#torneos y
// #eventos-pasados). Agregar/retirar un torneo = editar este archivo.

export type Torneo = {
  fecha: string;
  titulo: string;
  sede: string;
  poster: string;
  posterAlt: string;
  /** Dimensiones intrínsecas del archivo (para next/image, evita CLS). */
  posterWidth: number;
  posterHeight: number;
  /** Clase extra del póster (ej. logos que no son póster completo). */
  posterLogo?: boolean;
  /** Muestra el póster completo sin recortar (formatos distintos a 845x315, ej. 16:9). */
  posterCompleto?: boolean;
  /** Si es true, muestra el botón de registro por WhatsApp. */
  registroAbierto: boolean;
};

export const TORNEOS_PROXIMOS: Torneo[] = [
  {
    fecha: "24 de octubre",
    titulo: "Campeonato Abierto de Artes Marciales - Club Samoa",
    sede: "Ciudad Madero, Tamaulipas - Domo Uno (Centro de Convenciones).",
    poster: "/images/campeonato-abierto-samoa-2026.jpg",
    posterWidth: 1600,
    posterHeight: 900,
    posterAlt:
      "Poster del Campeonato Abierto de Artes Marciales 2026 - Ciudad Madero, Tamaulipas",
    posterCompleto: true,
    registroAbierto: true,
  },
  {
    fecha: "1 al 7 de noviembre",
    titulo: "Campeonato Mundial IMMAF 2026",
    sede: "Tbilisi, Georgia.",
    poster: "/images/2026-immaf-world-championships.jpg",
    posterWidth: 845,
    posterHeight: 315,
    posterAlt: "Poster del Campeonato Mundial IMMAF 2026 - Tbilisi, Georgia",
    registroAbierto: true,
  },
];

export const TORNEOS_PASADOS: Torneo[] = [
  {
    fecha: "9 al 15 de septiembre 2026",
    titulo: "Campeonato Panamericano IMMAF 2026",
    sede: "Monterrey, México.",
    poster: "/images/2026-immaf-pan-american-championships.jpg",
    posterWidth: 845,
    posterHeight: 315,
    posterAlt:
      "Poster del Campeonato Panamericano IMMAF 2026 - Monterrey, México",
    registroAbierto: false,
  },
  {
    fecha: "16 al 23 de agosto 2026",
    titulo: "Campeonato Mundial Juvenil IMMAF 2026",
    sede: "Abu Dhabi, Emiratos Árabes Unidos.",
    poster: "/images/2026-immaf-youth-world-championships.jpg",
    posterWidth: 845,
    posterHeight: 315,
    posterAlt: "Poster del Campeonato Mundial Juvenil IMMAF 2026 - Abu Dhabi",
    registroAbierto: false,
  },
  {
    fecha: "6 al 9 de agosto 2026",
    titulo: "Campeonato Nacional de Artes Marciales Mixtas - FAMM",
    sede: "Córdoba, Veracruz.",
    poster: "/images/campeonato-nacional-2026.jpg",
    posterWidth: 845,
    posterHeight: 315,
    posterAlt:
      "Poster del Campeonato Nacional de Artes Marciales Mixtas 2026 - Córdoba, Veracruz",
    registroAbierto: false,
  },
  {
    fecha: "22-24 de Mayo 2026",
    titulo: "Campeonato Regional de Artes Marciales Mixtas 2026",
    sede: "Monclova, Coahuila.",
    poster: "/images/regional2026.jpg",
    posterWidth: 845,
    posterHeight: 315,
    posterAlt: "Poster del Campeonato Regional de Artes Marciales Mixtas 2026",
    registroAbierto: false,
  },
  {
    fecha: "2 de Mayo 2026",
    titulo: "Campeonato Estatal de MMA Zona Norte de Tamaulipas",
    sede: "Nuevo Laredo, Tamaulipas - Nueva Ciudad Deportiva.",
    poster: "/images/estatal-znorte2026.jpeg",
    posterWidth: 845,
    posterHeight: 315,
    posterAlt: "Poster del Campeonato Estatal de MMA Zona Norte de Tamaulipas",
    registroAbierto: false,
  },
];

// Anuncio de bienvenida: el boleto que sale al abrir cualquier página del
// sitio público. Es solo para el torneo de aniversario del club, así que es
// un objeto único y no una lista. Deja de mostrarse solo después de `hasta`;
// para quitarlo antes, pon ANUNCIO_TORNEO = null.
export type AnuncioTorneo = {
  /** Identifica el anuncio en el navegador del visitante (para no repetirlo). */
  id: string;
  eyebrow: string;
  evento: string;
  /** Lo que va en grande, una línea por entrada. */
  titulo: string[];
  sede: string;
  /** Línea de texto normal debajo del boleto. */
  detalle: string;
  /** Texto vertical del talón y marca de agua al fondo. */
  talon: string;
  marca: string;
  /** Último día que se muestra, inclusive, en formato YYYY-MM-DD. */
  hasta: string;
  /** A dónde lleva "Ver el torneo". */
  href: string;
};

export const ANUNCIO_TORNEO: AnuncioTorneo | null = {
  id: "campeonato-abierto-2026",
  eyebrow: "Club Samoa presenta",
  evento: "Campeonato Abierto de Artes Marciales",
  titulo: ["24 de", "octubre"],
  sede: "Domo Uno, Cd. Madero",
  detalle:
    "Ciudad Madero, Tamaulipas — Domo Uno (Centro de Convenciones). Registro abierto por WhatsApp.",
  talon: "Entrada",
  marca: "2026",
  hasta: "2026-10-24",
  href: "/comunidad#torneos",
};
