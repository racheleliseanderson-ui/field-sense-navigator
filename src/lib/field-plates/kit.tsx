/**
 * Hook the Horizon — shared field plate kit.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk at
 * src/lib/field-plates/. Edit it there and run `node scripts/sync-fleet-shared.mjs`.
 * A local edit in a sibling repo will be overwritten without warning.
 *
 * Why this exists: seven instruments were explaining the same fishing problem
 * in seven visual languages, and six of them were explaining it in paragraphs.
 * A cross-section of a run means the same thing in Waterways as it does in
 * Field Ops, so it should be drawn by the same code.
 *
 * Three constraints the kit holds to:
 *
 *  1. Inline SVG with a viewBox and no fixed pixel size. One asset scales to a
 *     390px phone and prints without a raster.
 *  2. Colour comes from CSS custom properties with fallbacks, so a plate looks
 *     right in an app that never defined `--brass` and follows the theme in an
 *     app that did.
 *  3. No dependency beyond React. No icon library, no Tailwind class names, no
 *     app-specific types. A plate that needs app types is composed in the app.
 */

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

/**
 * Every colour a plate draws with resolves through one of these. The inner
 * `var()` is the host app's token; the literal is what a plate falls back to
 * in an app that never defined it. Both light and dark end up legible because
 * the fallbacks are mid-tone, not black-on-black.
 */
export const INK = "var(--hthp-ink, var(--foreground, #16191c))";
export const MUTED = "var(--hthp-muted, var(--muted-foreground, #6b7280))";
export const BRASS = "var(--hthp-accent, var(--brass, #b08428))";
export const PANEL = "var(--hthp-line, var(--panel-border, rgba(128,128,128,0.32)))";
export const DEEP = "var(--hthp-deep, var(--abyss, rgba(128,150,170,0.14)))";
export const LAND = "var(--hthp-land, var(--hull, rgba(128,128,128,0.16)))";
export const FOAM = "var(--hthp-foam, var(--foam, rgba(255,255,255,0.72)))";
export const PAPER = "var(--hthp-paper, var(--background, #ffffff))";
export const MONO = "var(--hthp-mono, var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace))";
export const SANS = "var(--hthp-sans, var(--font-sans, ui-sans-serif, system-ui, sans-serif))";

/** Warnings and confirmations, so a failed link reads the same in every app. */
export const ALARM = "var(--hthp-alarm, #c2410c)";
export const STEADY = "var(--hthp-steady, #4d7c5f)";
export const WATCH = "var(--hthp-watch, #a16207)";

export type Tone = "muted" | "ink" | "accent" | "alarm" | "steady" | "watch";

export function toneColor(tone: Tone | undefined): string {
  switch (tone) {
    case "ink":
      return INK;
    case "accent":
      return BRASS;
    case "alarm":
      return ALARM;
    case "steady":
      return STEADY;
    case "watch":
      return WATCH;
    default:
      return MUTED;
  }
}

/* ------------------------------------------------------------------ */
/* Viewport                                                            */
/* ------------------------------------------------------------------ */

/**
 * True on a screen wide enough to leave reading notes open.
 *
 * On a phone the notes fold behind one tap: they are reference you read once,
 * and left open they turn a page into a scroll marathon, which is the exact
 * thing that makes an app useless standing on rocks.
 */
export function useWidePlate(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

/* ------------------------------------------------------------------ */
/* Depth of explanation                                                */
/* ------------------------------------------------------------------ */

/**
 * How much a plate explains about itself.
 *
 * `plain` answers the question. `working` adds what it traded away.
 * `inspect` shows the inputs and the assumptions. A beginner should not be
 * made to start at `inspect`, and an advanced reader should not be stopped
 * at `plain` — so this is a setting, not a fork in the code.
 */
export type PlateDepth = "plain" | "working" | "inspect";

const DepthContext = createContext<PlateDepth>("working");

export function PlateDepthProvider({
  depth,
  children,
}: {
  depth: PlateDepth;
  children: ReactNode;
}) {
  return <DepthContext.Provider value={depth}>{children}</DepthContext.Provider>;
}

export function usePlateDepth(): PlateDepth {
  return useContext(DepthContext);
}

const DEPTH_RANK: Record<PlateDepth, number> = { plain: 0, working: 1, inspect: 2 };

/** Show `children` only once the reader has asked for at least `atLeast`. */
export function AtDepth({
  atLeast,
  children,
}: {
  atLeast: PlateDepth;
  children: ReactNode;
}) {
  const depth = usePlateDepth();
  if (DEPTH_RANK[depth] < DEPTH_RANK[atLeast]) return null;
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* Frame                                                               */
/* ------------------------------------------------------------------ */

/**
 * The frame every plate sits in: title, drawing, caption, legend, notes.
 *
 * `legend` is HTML under the drawing rather than text inside it, so a long
 * label can never collide with the diagram or overflow the viewBox — the
 * failure mode that makes generated diagrams look generated.
 */
export function Plate({
  eyebrow,
  title,
  caption,
  children,
  legend,
  aside,
  unknown,
  testid,
  notesLabel = "What this plate is telling you",
}: {
  eyebrow: string;
  title: string;
  caption?: string;
  children: ReactNode;
  legend?: ReactNode;
  aside?: ReactNode;
  /** What the drawing could not show, and why it matters. Never hidden. */
  unknown?: ReactNode;
  testid?: string;
  notesLabel?: string;
}) {
  const wide = useWidePlate();
  return (
    <figure className="hthp-plate" data-testid={testid}>
      <figcaption className="hthp-plate__head">
        <p className="hthp-eyebrow">{eyebrow}</p>
        <h4 className="hthp-plate__title">{title}</h4>
        {caption ? <p className="hthp-plate__caption">{caption}</p> : null}
      </figcaption>
      <div className="hthp-plate__frame">{children}</div>
      {legend ? <div className="hthp-plate__legend">{legend}</div> : null}
      {unknown ? (
        <p className="hthp-plate__unknown" data-testid="plate-unknown">
          {unknown}
        </p>
      ) : null}
      {aside ? (
        <details open={wide} className="hthp-plate__notes" data-testid="plate-notes">
          <summary className="hthp-plate__summary">
            {notesLabel}
            <Chevron />
          </summary>
          <div className="hthp-plate__notesbody">{aside}</div>
        </details>
      ) : null}
    </figure>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" className="hthp-chevron">
      <path
        d="M4 6.5 L8 10.5 L12 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Numbered legend row that pairs with `HoldingZone` and `Callout`. */
export function LegendRow({
  n,
  label,
  children,
  tone = "accent",
}: {
  n?: number;
  label: string;
  children?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="hthp-legend__row">
      {typeof n === "number" ? (
        <span className="hthp-legend__badge" style={{ background: toneColor(tone) }}>
          {n}
        </span>
      ) : (
        <span className="hthp-legend__swatch" style={{ background: toneColor(tone) }} />
      )}
      <span>
        <b className="hthp-legend__label">{label}</b>
        {children ? <span className="hthp-legend__body"> {children}</span> : null}
      </span>
    </div>
  );
}

/**
 * A drawing surface with a viewBox and no fixed height.
 *
 * `min` sets a minimum pixel width before the frame scrolls, so a chain of
 * eight components stays readable on a phone instead of compressing into a
 * smear. Scrolling one plate sideways is better than shrinking the labels
 * past the point where wet hands and bright sun can read them.
 */
export function Canvas({
  w,
  h,
  min,
  label,
  children,
}: {
  w: number;
  h: number;
  min?: number;
  /** Read to a screen reader in place of the drawing. Always write one. */
  label: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", minWidth: min ? `${min}px` : undefined, height: "auto", display: "block" }}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Water primitives                                                    */
/* ------------------------------------------------------------------ */

/** Water body with a subtle depth wash. */
export function WaterField({
  x,
  y,
  w,
  h,
  opacity = 1,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
}) {
  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={w} height={h} fill={DEEP} />
      <rect x={x} y={y} width={w} height={h} fill={BRASS} opacity={0.05} />
    </g>
  );
}

/**
 * Land hatch — the map convention, so bank never reads as water.
 *
 * The pattern id is scoped per instance because two plates on one page
 * otherwise share a single `#bank-hatch` and the second one silently adopts
 * the first one's fill.
 */
export function BankHatch({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill={LAND} />
        <line x1="0" y1="0" x2="0" y2="8" stroke={MUTED} strokeWidth="1.4" opacity="0.5" />
      </pattern>
    </defs>
  );
}

/** Bank strip. `side` decides which edge the waterline sits on. */
export function Bank({
  x,
  y,
  w,
  h,
  side,
  label,
  hatchId,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  side: "top" | "bottom";
  label?: string;
  hatchId: string;
}) {
  const lineY = side === "top" ? y + h : y;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${hatchId})`} />
      <line x1={x} y1={lineY} x2={x + w} y2={lineY} stroke={INK} strokeWidth={2} opacity={0.6} />
      {label ? (
        <text
          x={x + 10}
          y={side === "top" ? y + h - 8 : y + 16}
          fill={MUTED}
          fontSize={10}
          fontFamily={MONO}
          letterSpacing="0.14em"
        >
          {label.toUpperCase()}
        </text>
      ) : null}
    </g>
  );
}

/**
 * Current lines. `speed` 1-3 sets dash length, so a fast lane reads faster
 * than a slow one without needing a legend to say so.
 */
export function Flow({
  x,
  y,
  w,
  rows,
  gap,
  speed = 2,
  opacity = 0.5,
}: {
  x: number;
  y: number;
  w: number;
  rows: number;
  gap: number;
  speed?: 1 | 2 | 3;
  opacity?: number;
}) {
  const dash = speed === 1 ? "6 12" : speed === 2 ? "16 10" : "34 8";
  return (
    <g opacity={opacity}>
      {Array.from({ length: rows }, (_, i) => (
        <line
          key={i}
          x1={x}
          y1={y + i * gap}
          x2={x + w}
          y2={y + i * gap}
          stroke={MUTED}
          strokeWidth={1.25}
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

/** Riffle texture — short broken ticks that read as surface chop. */
export function Riffle({
  x,
  y,
  w,
  h,
  density = 26,
  seedFrom = 7,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  density?: number;
  seedFrom?: number;
}) {
  const ticks: ReactNode[] = [];
  let seed = seedFrom;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < density; i += 1) {
    const tx = x + rand() * w;
    const ty = y + rand() * h;
    ticks.push(
      <line
        key={i}
        x1={tx}
        y1={ty}
        x2={tx + 5}
        y2={ty - 4}
        stroke={FOAM}
        strokeWidth={1.3}
        strokeLinecap="round"
        opacity={0.75}
      />,
    );
  }
  return <g opacity={0.85}>{ticks}</g>;
}

/**
 * A holding zone. The badge sits on the zone; the wording lives in a
 * `LegendRow` under the drawing.
 */
export function HoldingZone({
  d,
  n,
  at,
  tone = "accent",
}: {
  d: string;
  n: number;
  /** Where the numbered badge sits, in viewBox units. */
  at: [number, number];
  tone?: Tone;
}) {
  const [cx, cy] = at;
  const c = toneColor(tone);
  return (
    <g>
      <path d={d} fill={c} fillOpacity={0.2} stroke={c} strokeWidth={1.75} strokeDasharray="7 5" />
      <circle cx={cx} cy={cy} r={11} fill={c} stroke={PAPER} strokeWidth={1.5} />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={PAPER}
        fontFamily={MONO}
      >
        {n}
      </text>
    </g>
  );
}

/** Where to put your feet. Deliberately a stance, never a pin. */
export function Stand({ x, y, label = "Stand" }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={9} fill="none" stroke={INK} strokeWidth={1.6} />
      <line x1={x - 4.5} y1={y - 4.5} x2={x + 4.5} y2={y + 4.5} stroke={INK} strokeWidth={1.6} />
      <line x1={x + 4.5} y1={y - 4.5} x2={x - 4.5} y2={y + 4.5} stroke={INK} strokeWidth={1.6} />
      <text
        x={x}
        y={y + 24}
        textAnchor="middle"
        fontSize={10}
        fill={INK}
        fontFamily={MONO}
        letterSpacing="0.12em"
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

/** Structure: wood, rock, weed. */
export function Structure({
  kind,
  x,
  y,
  scale = 1,
}: {
  kind: "wood" | "rock" | "weed";
  x: number;
  y: number;
  scale?: number;
}) {
  if (kind === "rock") {
    return (
      <g transform={`translate(${x},${y}) scale(${scale})`}>
        <path d="M0,0 L14,-8 L28,-3 L34,8 L20,15 L4,12 Z" fill={LAND} stroke={MUTED} strokeWidth={1.3} />
      </g>
    );
  }
  if (kind === "wood") {
    return (
      <g
        transform={`translate(${x},${y}) scale(${scale})`}
        stroke={MUTED}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      >
        <line x1={0} y1={0} x2={40} y2={10} />
        <line x1={12} y1={3} x2={26} y2={-9} />
        <line x1={24} y1={7} x2={38} y2={-4} />
      </g>
    );
  }
  return (
    <g
      transform={`translate(${x},${y}) scale(${scale})`}
      stroke={MUTED}
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
    >
      {[0, 7, 14, 21, 28].map((dx) => (
        <path key={dx} d={`M${dx},0 q3,-9 0,-17`} />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Marks, labels and arrows                                            */
/* ------------------------------------------------------------------ */

/**
 * A document-unique id safe to use in `url(#...)`.
 *
 * React's `useId` contains colons, which some SVG-to-PDF and print paths
 * refuse. Two plates on a page must not share a marker or a pattern, so the
 * id has to be per-instance rather than a module constant.
 */
export function usePlateId(prefix: string): string {
  const raw = useId();
  return useMemo(() => `${prefix}-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`, [prefix, raw]);
}

/** Small caption inside the drawing. */
export function Note({
  x,
  y,
  children,
  anchor = "start",
  tone = "muted",
  size = 11,
}: {
  x: number;
  y: number;
  children: string;
  anchor?: "start" | "middle" | "end";
  tone?: Tone;
  size?: number;
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={toneColor(tone)} fontFamily={SANS}>
      {children}
    </text>
  );
}

/** All-caps mono label, for anything the eye should treat as a field name. */
export function Tag({
  x,
  y,
  children,
  anchor = "start",
  tone = "muted",
  size = 10,
}: {
  x: number;
  y: number;
  children: string;
  anchor?: "start" | "middle" | "end";
  tone?: Tone;
  size?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fill={toneColor(tone)}
      fontFamily={MONO}
      letterSpacing="0.13em"
    >
      {children.toUpperCase()}
    </text>
  );
}

/**
 * A straight or curved arrow with a head.
 *
 * `bow` bends it; 0 is straight. Used for cast arcs, load direction, current
 * vectors and handoffs between blocks, so all of those read as the same idea.
 */
export function Arrow({
  from,
  to,
  bow = 0,
  tone = "ink",
  dashed = false,
  width = 1.5,
  label,
}: {
  from: [number, number];
  to: [number, number];
  bow?: number;
  tone?: Tone;
  dashed?: boolean;
  width?: number;
  label?: string;
}) {
  const id = usePlateId("arrow");
  const [x1, y1] = from;
  const [x2, y2] = to;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + bow;
  const c = toneColor(tone);
  return (
    <g>
      <defs>
        <marker
          id={id}
          markerWidth={9}
          markerHeight={9}
          refX={7}
          refY={4.5}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L9,4.5 L0,9 z" fill={c} />
        </marker>
      </defs>
      <path
        d={bow === 0 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`}
        fill="none"
        stroke={c}
        strokeWidth={width}
        strokeDasharray={dashed ? "5 5" : undefined}
        markerEnd={`url(#${id})`}
        opacity={0.9}
      />
      {label ? (
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize={10}
          fill={c}
          fontFamily={MONO}
          letterSpacing="0.12em"
        >
          {label.toUpperCase()}
        </text>
      ) : null}
    </g>
  );
}

/** Dashed cast arc — an `Arrow` with the conventions a cast expects. */
export function Cast({
  from,
  to,
  bow = -30,
  label,
}: {
  from: [number, number];
  to: [number, number];
  bow?: number;
  label?: string;
}) {
  return <Arrow from={from} to={to} bow={bow} dashed tone="ink" label={label} />;
}

/**
 * A leader line from a point on the drawing out to a numbered badge.
 *
 * The wording belongs in the legend; this only says which part of the picture
 * the legend row is about.
 */
export function Callout({
  at,
  to,
  n,
  tone = "accent",
}: {
  at: [number, number];
  to: [number, number];
  n: number;
  tone?: Tone;
}) {
  const c = toneColor(tone);
  return (
    <g>
      <line x1={at[0]} y1={at[1]} x2={to[0]} y2={to[1]} stroke={c} strokeWidth={1.2} opacity={0.75} />
      <circle cx={to[0]} cy={to[1]} r={10} fill={c} stroke={PAPER} strokeWidth={1.4} />
      <text
        x={to[0]}
        y={to[1] + 4}
        textAnchor="middle"
        fontSize={10.5}
        fontWeight={700}
        fill={PAPER}
        fontFamily={MONO}
      >
        {n}
      </text>
    </g>
  );
}

/**
 * A failure mark. Not a decoration — it means this is the place that gives
 * out first, and the legend row beside it has to say under what load.
 */
export function FailureMark({
  x,
  y,
  scale = 1,
  tone = "alarm",
}: {
  x: number;
  y: number;
  scale?: number;
  tone?: Tone;
}) {
  const c = toneColor(tone);
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <line
          key={deg}
          x1={0}
          y1={0}
          x2={0}
          y2={-13}
          stroke={c}
          strokeWidth={2.1}
          strokeLinecap="round"
          transform={`rotate(${deg})`}
        />
      ))}
      <circle cx={0} cy={0} r={4.4} fill={c} />
    </g>
  );
}

/** A dimension bracket with a measurement, for spacing and length. */
export function Span({
  from,
  to,
  y,
  label,
  tone = "muted",
}: {
  from: number;
  to: number;
  y: number;
  label: string;
  tone?: Tone;
}) {
  const c = toneColor(tone);
  return (
    <g>
      <line x1={from} y1={y - 5} x2={from} y2={y + 5} stroke={c} strokeWidth={1.2} />
      <line x1={to} y1={y - 5} x2={to} y2={y + 5} stroke={c} strokeWidth={1.2} />
      <line x1={from} y1={y} x2={to} y2={y} stroke={c} strokeWidth={1.2} strokeDasharray="3 3" />
      <text
        x={(from + to) / 2}
        y={y - 8}
        textAnchor="middle"
        fontSize={9.5}
        fill={c}
        fontFamily={MONO}
        letterSpacing="0.1em"
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Depth column                                                        */
/* ------------------------------------------------------------------ */

export const DEPTH_ROWS = [
  { id: "film", label: "Film" },
  { id: "upper", label: "Upper" },
  { id: "mid", label: "Mid" },
  { id: "near-bottom", label: "Near bottom" },
  { id: "bottom", label: "Bottom" },
] as const;

export type DepthRowId = (typeof DEPTH_ROWS)[number]["id"];

/**
 * Which band of the column is actually being fished.
 *
 * `active` may name one band, several, or `varies` — which is not a failure
 * to decide. Some days the honest answer is that the layer has to be found
 * before anything else is worth arguing about, and the plate should say so
 * rather than pick one to look confident.
 */
export function DepthColumn({
  x,
  y,
  w,
  h,
  active,
  labels = true,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  active: DepthRowId | "varies" | readonly DepthRowId[];
  labels?: boolean;
}) {
  const set = new Set<string>(
    typeof active === "string" ? (active === "varies" ? [] : [active]) : active,
  );
  const rowH = h / DEPTH_ROWS.length;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={DEEP} stroke={PANEL} strokeWidth={1} />
      {DEPTH_ROWS.map((row, i) => {
        const on = set.has(row.id);
        const ry = y + i * rowH;
        return (
          <g key={row.id}>
            {on ? <rect x={x} y={ry} width={w} height={rowH} fill={BRASS} fillOpacity={0.22} /> : null}
            <line x1={x} y1={ry} x2={x + w} y2={ry} stroke={PANEL} strokeWidth={0.75} />
            {labels ? (
              <text
                x={x + 8}
                y={ry + rowH / 2 + 4}
                fontSize={10}
                fill={on ? BRASS : MUTED}
                fontFamily={MONO}
                letterSpacing="0.1em"
              >
                {row.label.toUpperCase()}
              </text>
            ) : null}
          </g>
        );
      })}
      {active === "varies" ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + 4}
          textAnchor="middle"
          fontSize={10}
          fill={BRASS}
          fontFamily={MONO}
          letterSpacing="0.1em"
        >
          FIND THE LAYER
        </text>
      ) : null}
    </g>
  );
}
