// Cálculo del podio de un bracket (puerto de computePodium_ en
// legacy/admin/js/evento-resumen.js). Lógica pura, sin DOM ni red.
//
//   🥇 1° — ganador de la final
//   🥈 2° — perdedor de la final
//   🥉 3° — perdedores de las semifinales (joint third)
//
// Para brackets de 2 atletas (dos_atletas) no hay semifinales → sin terceros.

export interface AtletaPodio {
  id?: string;
  nombre_completo?: string;
  academia?: string;
}

export interface PeleaPodio {
  ronda_idx?: number | string | null;
  atleta1_id?: string;
  atleta2_id?: string;
  atleta1?: AtletaPodio | null;
  atleta2?: AtletaPodio | null;
  ganador_id?: string | null;
  ganador?: AtletaPodio | null;
  bye?: boolean;
}

export interface Podio {
  complete: boolean;
  first: AtletaPodio | null;
  second: AtletaPodio | null;
  thirds: AtletaPodio[];
}

function placeholder(id: string | undefined | null): AtletaPodio | null {
  if (!id) return null;
  return { id, nombre_completo: id, academia: "" };
}

export function computePodium(peleas: PeleaPodio[] | null | undefined): Podio {
  const lista = peleas ?? [];
  if (lista.length === 0) {
    return { complete: false, first: null, second: null, thirds: [] };
  }

  let maxIdx = 0;
  lista.forEach((p) => {
    const idx = Number(p.ronda_idx) || 0;
    if (idx > maxIdx) maxIdx = idx;
  });

  // La final es la única pelea con ronda_idx === maxIdx
  const final = lista.find((p) => Number(p.ronda_idx) === maxIdx);
  if (!final || !final.ganador_id) {
    return { complete: false, first: null, second: null, thirds: [] };
  }

  const first = final.ganador || placeholder(final.ganador_id);
  const secondId =
    final.atleta1_id === final.ganador_id ? final.atleta2_id : final.atleta1_id;
  let second =
    final.atleta1_id === final.ganador_id ? final.atleta2 : final.atleta1;
  if (!second && secondId) second = placeholder(secondId);

  // Terceros: perdedores de semis (ronda_idx = maxIdx - 1). Los byes no
  // cuentan — nadie perdió esa "pelea".
  const thirds: AtletaPodio[] = [];
  if (maxIdx >= 1) {
    lista
      .filter((p) => Number(p.ronda_idx) === maxIdx - 1)
      .forEach((s) => {
        if (!s.ganador_id || s.bye) return;
        const loserAtleta =
          s.atleta1_id === s.ganador_id ? s.atleta2 : s.atleta1;
        const loserId =
          s.atleta1_id === s.ganador_id ? s.atleta2_id : s.atleta1_id;
        const atleta = loserAtleta || placeholder(loserId);
        if (loserId && atleta) thirds.push(atleta);
      });
  }

  return {
    complete: true,
    first: first ?? null,
    second: second ?? null,
    thirds,
  };
}
