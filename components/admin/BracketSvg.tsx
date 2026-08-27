import type { CSSProperties } from "react";

// Puerto de legacy/admin/js/bracket-svg.js (370 líneas): de createElementNS
// imperativo a JSX declarativo. El SVG pasa a ser una función de los datos.
// Mismo viewBox, mismas coordenadas y mismo sistema de escalado que legacy —
// cualquier diferencia de geometría es un bug de puerto, no un rediseño.
//
// Layout:
//   - Columnas left→right, una por ronda.
//   - R1: matches apilados verticalmente con espaciado constante.
//   - Rondas siguientes: cada match en el midpoint vertical de sus dos
//     feeders (peleas anteriores).
//   - Conectores tipo "shelf" (horizontal-vertical-horizontal).
//
// Estilos: ver app/admin.css (selectores .bracket-svg-*).

export interface AtletaSvg {
  id?: string;
  nombre_completo?: string;
  academia?: string;
}

export interface PeleaSvg {
  id?: string;
  ronda?: string;
  ronda_idx?: number | string | null;
  numero_pelea?: number | string | null;
  numero_en_ronda?: number | string | null;
  atleta1?: AtletaSvg | null;
  atleta2?: AtletaSvg | null;
  atleta1_id?: string;
  atleta2_id?: string;
  bye?: boolean;
  ganador_id?: string | null;
  ganador?: { id?: string } | null;
  pelea_anterior_1?: number | string | null;
  pelea_anterior_2?: number | string | null;
}

export interface BracketSvgData {
  peleas?: PeleaSvg[] | null;
}

export interface BracketSvgOpts {
  compact?: boolean;
}

const DEFAULTS = {
  COL_WIDTH: 220,
  COL_GAP: 56,
  BOX_HEIGHT: 60,
  R1_VERTICAL_SPACING: 96, // distancia top-to-top entre R1 matches
  HEADER_HEIGHT: 28,
  PADDING: 16,
  NAME_MAX: 22,
  ACADEMIA_MAX: 26,
};

type LayoutConfig = typeof DEFAULTS;

function configFor(opts?: BracketSvgOpts): LayoutConfig {
  const cfg = { ...DEFAULTS };
  if (opts?.compact) {
    cfg.COL_WIDTH = 180;
    cfg.BOX_HEIGHT = 50;
    cfg.R1_VERTICAL_SPACING = 80;
    cfg.NAME_MAX = 18;
    cfg.ACADEMIA_MAX = 22;
  }
  return cfg;
}

export interface BracketLayout {
  width: number;
  height: number;
  matches: Record<string, { x: number; y: number }>;
  rounds: Record<number, PeleaSvg[]>;
  maxIdx: number;
  cfg: LayoutConfig;
}

/** Calcula posiciones sin renderizar. Útil para tests y dimensiones. */
export function computeLayout(
  bracketData: BracketSvgData | null | undefined,
  opts?: BracketSvgOpts,
): BracketLayout {
  const cfg = configFor(opts);
  const peleas = bracketData?.peleas || [];
  if (peleas.length === 0) {
    return {
      width: cfg.PADDING * 2,
      height: cfg.PADDING * 2,
      matches: {},
      rounds: {},
      maxIdx: 0,
      cfg,
    };
  }

  // Agrupar por ronda_idx y ordenar dentro de cada ronda
  const rounds: Record<number, PeleaSvg[]> = {};
  let maxIdx = 0;
  peleas.forEach((p) => {
    const idx = Number(p.ronda_idx) || 0;
    (rounds[idx] ??= []).push(p);
    if (idx > maxIdx) maxIdx = idx;
  });
  Object.keys(rounds).forEach((k) => {
    rounds[Number(k)]!.sort(
      (a, b) =>
        (Number(a.numero_en_ronda) || 0) - (Number(b.numero_en_ronda) || 0),
    );
  });

  const matches: Record<string, { x: number; y: number }> = {};

  // Round 0 (R1): apilados con espaciado constante
  (rounds[0] || []).forEach((p, i) => {
    matches[String(p.numero_pelea)] = {
      x: cfg.PADDING,
      y: cfg.HEADER_HEIGHT + cfg.PADDING + i * cfg.R1_VERTICAL_SPACING,
    };
  });

  // Rondas siguientes: cada match en el midpoint de sus feeders
  for (let ri = 1; ri <= maxIdx; ri += 1) {
    (rounds[ri] || []).forEach((p) => {
      const f1 = matches[String(p.pelea_anterior_1)];
      const f2 = matches[String(p.pelea_anterior_2)];
      let midY: number;
      if (f1 && f2) {
        midY = (f1.y + f2.y) / 2;
      } else if (f1) {
        midY = f1.y;
      } else if (f2) {
        midY = f2.y;
      } else {
        midY = cfg.HEADER_HEIGHT + cfg.PADDING;
      }
      matches[String(p.numero_pelea)] = {
        x: cfg.PADDING + ri * (cfg.COL_WIDTH + cfg.COL_GAP),
        y: midY,
      };
    });
  }

  // Dimensiones totales
  const width =
    cfg.PADDING * 2 + (maxIdx + 1) * cfg.COL_WIDTH + maxIdx * cfg.COL_GAP;
  let maxY = 0;
  Object.values(matches).forEach((m) => {
    if (m.y > maxY) maxY = m.y;
  });
  const height = maxY + cfg.BOX_HEIGHT + cfg.PADDING;

  return { width, height, matches, rounds, maxIdx, cfg };
}

function truncate(s: string | undefined | null, max: number): string {
  if (!s) return "";
  const str = String(s);
  if (str.length <= max) return str;
  return str.substring(0, max - 1) + "…";
}

function Slot({
  atleta,
  x,
  y,
  w,
  h,
  isWinner,
  isLoser,
  isByeSlot,
  cfg,
}: {
  atleta: AtletaSvg | null;
  x: number;
  y: number;
  w: number;
  h: number;
  isWinner: boolean;
  isLoser: boolean;
  isByeSlot: boolean;
  cfg: LayoutConfig;
}) {
  const cls = ["bracket-svg-match-slot"];
  if (isWinner) cls.push("is-winner");
  if (isLoser) cls.push("is-loser");
  if (isByeSlot) cls.push("is-bye");

  // El slot necesita al menos 26px de alto para acomodar nombre + academia
  // (dos líneas). Si es más chico, solo el nombre centrado.
  const canFitTwoLines = h >= 26;
  const name = atleta ? atleta.nombre_completo || atleta.id || "" : "";
  const academia = atleta?.academia || "";
  const showAca = !!academia && canFitTwoLines;

  return (
    <g className={cls.join(" ")}>
      {isWinner && (
        <rect
          className="bracket-svg-slot-winner-bg"
          x={x}
          y={y}
          width={w}
          height={h}
        />
      )}
      {isByeSlot ? (
        <text
          className="bracket-svg-bye-label"
          x={x + w / 2}
          y={y + h * 0.65}
          textAnchor="middle"
        >
          BYE
        </text>
      ) : !atleta ? (
        <text
          className="bracket-svg-tbd"
          x={x + w / 2}
          y={y + h * 0.7}
          textAnchor="middle"
        >
          —
        </text>
      ) : showAca ? (
        <>
          <text className="bracket-svg-name" x={x + 10} y={y + h * 0.42}>
            {truncate(name, cfg.NAME_MAX)}
          </text>
          <text className="bracket-svg-academia" x={x + 10} y={y + h * 0.82}>
            {truncate(academia, cfg.ACADEMIA_MAX)}
          </text>
        </>
      ) : (
        <text className="bracket-svg-name" x={x + 10} y={y + h * 0.65}>
          {truncate(name, cfg.NAME_MAX)}
        </text>
      )}
      {isWinner && (
        <text
          className="bracket-svg-check"
          x={x + w - 10}
          y={y + h * 0.65}
          textAnchor="end"
        >
          ✓
        </text>
      )}
    </g>
  );
}

function Match({
  pelea,
  x,
  y,
  cfg,
  onMatchClick,
}: {
  pelea: PeleaSvg;
  x: number;
  y: number;
  cfg: LayoutConfig;
  onMatchClick?: (peleaId: string, numero: string) => void;
}) {
  const p = pelea;
  // Si no vienen objetos atleta pero hay atleta1_id/atleta2_id, placeholder
  const a1 =
    p.atleta1 ??
    (p.atleta1_id ? { id: p.atleta1_id, nombre_completo: p.atleta1_id } : null);
  const a2 =
    p.atleta2 ??
    (p.atleta2_id ? { id: p.atleta2_id, nombre_completo: p.atleta2_id } : null);

  const ganador = p.ganador_id || p.ganador?.id || "";
  const halfH = cfg.BOX_HEIGHT / 2;
  const bye = !!p.bye;

  const a1IsWinner = !!ganador && !!a1 && a1.id === ganador;
  const a2IsWinner = !!ganador && !!a2 && a2.id === ganador;
  const a1IsLoser = !!ganador && !a1IsWinner && !!a1;
  const a2IsLoser = !!ganador && !a2IsWinner && !!a2;

  const w = cfg.COL_WIDTH;
  const clickable = typeof onMatchClick === "function";
  const style: CSSProperties | undefined = clickable
    ? { cursor: "pointer" }
    : undefined;

  return (
    <g
      className="bracket-svg-match"
      data-pelea-id={p.id || ""}
      data-numero={String(p.numero_pelea ?? "")}
      style={style}
      onClick={
        clickable
          ? () => onMatchClick(p.id || "", String(p.numero_pelea ?? ""))
          : undefined
      }
    >
      <rect
        className="bracket-svg-match-bg"
        x={x}
        y={y}
        width={w}
        height={cfg.BOX_HEIGHT}
        rx={4}
      />
      {p.numero_pelea !== undefined && p.numero_pelea !== null && (
        <text className="bracket-svg-match-num" x={x + 6} y={y - 4}>
          #{String(p.numero_pelea)}
        </text>
      )}
      <Slot
        atleta={a1}
        x={x}
        y={y}
        w={w}
        h={halfH}
        isWinner={a1IsWinner}
        isLoser={a1IsLoser}
        isByeSlot={bye && !a1}
        cfg={cfg}
      />
      <line
        className="bracket-svg-match-divider"
        x1={x}
        y1={y + halfH}
        x2={x + w}
        y2={y + halfH}
      />
      <Slot
        atleta={a2}
        x={x}
        y={y + halfH}
        w={w}
        h={halfH}
        isWinner={a2IsWinner}
        isLoser={a2IsLoser}
        isByeSlot={bye && !a2}
        cfg={cfg}
      />
    </g>
  );
}

export default function BracketSvg({
  bracket,
  compact,
  onMatchClick,
}: {
  bracket: BracketSvgData;
  compact?: boolean;
  onMatchClick?: (peleaId: string, numero: string) => void;
}) {
  const layout = computeLayout(bracket, { compact });
  const { cfg, matches } = layout;
  const peleas = bracket?.peleas || [];

  const connectors: { key: string; d: string }[] = [];
  for (let ri = 1; ri <= layout.maxIdx; ri += 1) {
    (layout.rounds[ri] || []).forEach((p) => {
      const dest = matches[String(p.numero_pelea)];
      if (!dest) return;
      const x2 = dest.x;
      const y2 = dest.y + cfg.BOX_HEIGHT / 2;
      [p.pelea_anterior_1, p.pelea_anterior_2].forEach((anterior, i) => {
        if (anterior === "" || anterior === null || anterior === undefined)
          return;
        const src = matches[String(anterior)];
        if (!src) return;
        const x1 = src.x + cfg.COL_WIDTH;
        const y1 = src.y + cfg.BOX_HEIGHT / 2;
        const midX = (x1 + x2) / 2;
        connectors.push({
          key: `${p.numero_pelea}-${i}`,
          d: `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`,
        });
      });
    });
  }

  return (
    <svg
      className="bracket-svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
    >
      {Object.keys(layout.rounds).map((riKey) => {
        const ri = Number(riKey);
        const primera = layout.rounds[ri]?.[0];
        const label = (primera?.ronda || `ronda_${ri}`).toUpperCase();
        const cx =
          cfg.PADDING + ri * (cfg.COL_WIDTH + cfg.COL_GAP) + cfg.COL_WIDTH / 2;
        return (
          <text
            key={riKey}
            className="bracket-svg-round-label"
            x={cx}
            y={cfg.HEADER_HEIGHT - 4}
            textAnchor="middle"
          >
            {label}
          </text>
        );
      })}
      {connectors.map((c) => (
        <path
          key={c.key}
          className="bracket-svg-connector"
          d={c.d}
          fill="none"
        />
      ))}
      {peleas.map((p, i) => {
        const pos = matches[String(p.numero_pelea)];
        if (!pos) return null;
        return (
          <Match
            key={p.id || p.numero_pelea || i}
            pelea={p}
            x={pos.x}
            y={pos.y}
            cfg={cfg}
            onMatchClick={onMatchClick}
          />
        );
      })}
    </svg>
  );
}
