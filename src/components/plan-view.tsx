/**
 * Plan view — the drawing, and the controls that move it.
 *
 * Four hand-drawn schematics, one per water class, with the read zones marked
 * on them. The controls are the point: wind direction, water state and tide
 * are not decoration, they change which zones are lit and the app says in one
 * sentence why.
 *
 * Everything is inline SVG on a viewBox, so it scales to a phone, prints
 * without a raster and works with no network.
 */

import { useMemo, useState, type ReactElement, type ReactNode } from "react";

import {
  DEFAULT_PLAN_STATE,
  TIDES,
  TIDE_LABEL,
  WATER_STATES,
  WATER_STATE_LABEL,
  WIND_POINTS,
  readPlan,
  planSummary,
  schematicFor,
  type Emphasis,
  type PlanSchematic,
  type PlanState,
  type PlanWaterState,
  type TideState,
  type WindPoint,
  type ZoneRead,
} from "@/lib/plan-view";
import type { WaterType } from "@/lib/catalog";
import type { ReadLevel } from "@/lib/water-reading";

const W = 1000;
const H = 620;

const INK = "var(--foreground)";
const MUTED = "var(--muted-foreground)";
const BRASS = "var(--brass, #c8a24a)";

const EMPHASIS_STYLE: Record<Emphasis, { fill: string; opacity: number; stroke: number }> = {
  strong: { fill: BRASS, opacity: 0.42, stroke: 2.4 },
  normal: { fill: BRASS, opacity: 0.16, stroke: 1.3 },
  quiet: { fill: MUTED, opacity: 0.1, stroke: 1 },
  off: { fill: MUTED, opacity: 0.04, stroke: 0.9 },
};

/* ------------------------------------------------------------------ */
/* Base drawings                                                       */
/* ------------------------------------------------------------------ */

function Defs() {
  return (
    <defs>
      <pattern
        id="pv-land"
        width="9"
        height="9"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="9" height="9" fill="var(--card, #14171b)" />
        <line x1="0" y1="0" x2="0" y2="9" stroke={MUTED} strokeWidth="1.1" opacity="0.35" />
      </pattern>
      <linearGradient id="pv-deep" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--accent, #2b4a63)" stopOpacity="0.30" />
        <stop offset="100%" stopColor="var(--accent, #2b4a63)" stopOpacity="0.55" />
      </linearGradient>
    </defs>
  );
}

function Water({ d, deep }: { d: string; deep?: boolean }) {
  return (
    <path
      d={d}
      fill={deep ? "url(#pv-deep)" : "var(--accent, #2b4a63)"}
      fillOpacity={deep ? 1 : 0.22}
      stroke={MUTED}
      strokeWidth={1.1}
      strokeOpacity={0.5}
    />
  );
}

/** A chevron pointing the way the water is going. */
function Flow({
  x,
  y,
  angle = 0,
  scale = 1,
}: {
  x: number;
  y: number;
  angle?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`} opacity={0.5}>
      <path d="M -12 -8 L 4 0 L -12 8" fill="none" stroke={INK} strokeWidth={2} opacity={0.55} />
    </g>
  );
}

const RIVER_TOP =
  "M 0 215 C 120 195 200 150 430 95 C 560 64 660 76 760 200 C 820 272 900 235 1000 232";
const RIVER_BOTTOM =
  "M 1000 378 C 900 372 830 400 760 372 C 660 332 610 492 430 470 C 260 450 150 372 0 345";

function RiverBase() {
  return (
    <g>
      <rect width={W} height={H} fill="url(#pv-land)" />
      <Water d={`${RIVER_TOP} L 1000 378 ${RIVER_BOTTOM.replace("M 1000 378", "")} Z`} />
      {/* tributary dropping in from the top right */}
      <Water d="M 828 0 L 892 0 C 884 70 878 140 872 196 L 838 190 C 836 128 832 62 828 0 Z" />
      {/* riffle texture at the head */}
      <g opacity={0.5}>
        {Array.from({ length: 16 }, (_, i) => (
          <line
            key={i}
            x1={60 + (i % 8) * 18}
            y1={236 + Math.floor(i / 8) * 26}
            x2={74 + (i % 8) * 18}
            y2={236 + Math.floor(i / 8) * 26}
            stroke={INK}
            strokeWidth={1.6}
            opacity={0.4}
          />
        ))}
      </g>
      {/* the boulder that makes the eddy */}
      <ellipse cx={332} cy={384} rx={20} ry={13} fill={MUTED} opacity={0.55} />
      <Flow x={90} y={286} angle={-8} />
      <Flow x={300} y={250} angle={-26} />
      <Flow x={560} y={190} angle={12} />
      <Flow x={820} y={318} angle={-6} />
      <text x={16} y={H - 16} fontSize="15" fontFamily="ui-monospace, monospace" fill={MUTED}>
        flow →
      </text>
    </g>
  );
}

const LAKE_SHORE =
  "M 120 300 C 110 170 230 70 430 62 C 620 55 800 70 890 180 C 950 254 930 420 830 500 C 720 588 420 596 268 528 C 150 476 130 400 120 300 Z";

function LakeBase() {
  return (
    <g>
      <rect width={W} height={H} fill="url(#pv-land)" />
      <Water d={LAKE_SHORE} />
      {/* deeper basin */}
      <Water
        deep
        d="M 300 300 C 300 220 400 168 540 172 C 690 176 790 244 790 330 C 790 420 660 470 520 466 C 380 462 300 390 300 300 Z"
      />
      {/* the point, a wedge of land intruding from the north-west */}
      <path
        d="M 118 120 L 352 196 L 300 232 L 120 240 Z"
        fill="url(#pv-land)"
        stroke={MUTED}
        strokeWidth={1.1}
        strokeOpacity={0.5}
      />
      {/* its underwater extension, which is the part that matters */}
      <path
        d="M 352 196 L 430 226"
        stroke={MUTED}
        strokeWidth={2.2}
        strokeDasharray="7 6"
        opacity={0.7}
      />
      {/* inflow */}
      <Water d="M 704 0 L 742 0 L 736 132 L 706 128 Z" />
      {/* weed bed */}
      <g opacity={0.55}>
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d={`M ${196 + i * 16} ${452 + (i % 3) * 9} q 5 -16 0 -30`}
            fill="none"
            stroke={MUTED}
            strokeWidth={1.6}
          />
        ))}
      </g>
      <text
        x={500}
        y={44}
        fontSize="15"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fill={MUTED}
      >
        N
      </text>
    </g>
  );
}

function ReservoirBase() {
  return (
    <g>
      <rect width={W} height={H} fill="url(#pv-land)" />
      <Water d="M 96 250 L 96 400 C 240 430 340 470 470 500 C 620 534 760 520 940 490 L 960 430 C 800 420 700 400 640 360 C 560 306 460 288 330 274 C 240 264 160 258 96 250 Z" />
      {/* creek arm running up to the north-east */}
      <Water d="M 640 360 C 690 300 740 244 800 176 L 862 206 C 800 276 742 336 700 396 Z" />
      {/* the old river channel */}
      <path
        d="M 110 322 C 260 318 380 330 500 340 C 640 352 760 400 900 452"
        fill="none"
        stroke={BRASS}
        strokeWidth={2.6}
        strokeDasharray="10 7"
        opacity={0.75}
      />
      {/* dam face */}
      <path d="M 96 248 L 96 402" stroke={INK} strokeWidth={7} opacity={0.6} />
      <g opacity={0.6}>
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={i}
            x1={100}
            y1={256 + i * 17}
            x2={124}
            y2={252 + i * 17}
            stroke={MUTED}
            strokeWidth={1.6}
          />
        ))}
      </g>
      {/* standing timber */}
      <g opacity={0.7}>
        {[380, 404, 428, 452, 476].map((x, i) => (
          <line
            key={x}
            x1={x}
            y1={440 + (i % 2) * 8}
            x2={x}
            y2={410 + (i % 2) * 8}
            stroke={MUTED}
            strokeWidth={2.2}
          />
        ))}
      </g>
      <text x={128} y={228} fontSize="14" fontFamily="ui-monospace, monospace" fill={MUTED}>
        dam
      </text>
      <text
        x={880}
        y={520}
        fontSize="14"
        textAnchor="end"
        fontFamily="ui-monospace, monospace"
        fill={MUTED}
      >
        feeder stream
      </text>
    </g>
  );
}

function CoastBase() {
  return (
    <g>
      <rect width={W} height={H} fill="var(--accent, #2b4a63)" fillOpacity={0.2} />
      {/* land */}
      <path
        d="M 0 620 L 0 470 C 40 380 90 300 140 258 C 176 228 210 262 206 320 C 202 392 300 452 420 462 C 540 472 640 470 742 436 L 780 470 C 820 520 860 560 1000 566 L 1000 620 Z"
        fill="url(#pv-land)"
        stroke={MUTED}
        strokeWidth={1.1}
        strokeOpacity={0.5}
      />
      {/* estuary channel cutting back into the land */}
      <Water d="M 742 436 L 780 470 C 830 512 880 540 1000 548 L 1000 620 L 860 620 C 820 560 780 500 742 462 Z" />
      {/* outer bar — where it breaks */}
      <g opacity={0.75}>
        {Array.from({ length: 22 }, (_, i) => (
          <path
            key={i}
            d={`M ${120 + i * 34} ${268 - Math.sin(i / 3) * 10} q 10 -9 20 0`}
            fill="none"
            stroke={INK}
            strokeWidth={2}
            opacity={0.45}
          />
        ))}
      </g>
      {/* the rip cut through the bar */}
      <path
        d="M 600 420 C 596 370 600 320 604 250"
        fill="none"
        stroke={BRASS}
        strokeWidth={3}
        strokeDasharray="9 7"
        opacity={0.8}
      />
      <Flow x={604} y={236} angle={-90} scale={1.2} />
      {/* shore break */}
      <g opacity={0.5}>
        {Array.from({ length: 18 }, (_, i) => (
          <path
            key={i}
            d={`M ${210 + i * 30} ${430 + Math.sin(i / 2) * 8} q 9 -7 18 0`}
            fill="none"
            stroke={INK}
            strokeWidth={1.6}
          />
        ))}
      </g>
      <text
        x={500}
        y={70}
        fontSize="15"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fill={MUTED}
      >
        open sea
      </text>
      <text x={90} y={596} fontSize="15" fontFamily="ui-monospace, monospace" fill={MUTED}>
        beach
      </text>
    </g>
  );
}

const BASE: Record<PlanSchematic["kind"], () => ReactElement> = {
  "river-reach": RiverBase,
  "lake-basin": LakeBase,
  "reservoir-arm": ReservoirBase,
  coast: CoastBase,
};

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`min-h-11 border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
        active
          ? "border-[color:var(--brass,#c8a24a)] bg-[color:var(--brass,#c8a24a)]/10 text-[color:var(--brass,#c8a24a)]"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** The wind dial — eight points around a circle, because a row of buttons loses the geometry. */
function WindDial({
  value,
  onChange,
}: {
  value: WindPoint | null;
  onChange: (next: WindPoint | null) => void;
}) {
  const R = 46;
  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="-70 -70 140 140"
        className="h-32 w-32 shrink-0"
        role="group"
        aria-label="Wind direction"
      >
        <circle r={R + 12} fill="none" stroke={MUTED} strokeWidth={1} opacity={0.35} />
        {WIND_POINTS.map((point, i) => {
          const angle = ((i * 45 - 90) * Math.PI) / 180;
          const x = Math.cos(angle) * R;
          const y = Math.sin(angle) * R;
          const active = value === point;
          return (
            <g
              key={point}
              onClick={() => onChange(active ? null : point)}
              className="cursor-pointer"
            >
              <circle
                cx={x}
                cy={y}
                r={15}
                fill={active ? BRASS : "transparent"}
                fillOpacity={active ? 0.25 : 1}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontSize="11"
                fontFamily="ui-monospace, monospace"
                fill={active ? BRASS : MUTED}
              >
                {point}
              </text>
              <title>{`Wind from the ${point}`}</title>
            </g>
          );
        })}
        {value ? (
          <g opacity={0.85}>
            <line
              x1={Math.cos(((WIND_POINTS.indexOf(value) * 45 - 90) * Math.PI) / 180) * (R - 18)}
              y1={Math.sin(((WIND_POINTS.indexOf(value) * 45 - 90) * Math.PI) / 180) * (R - 18)}
              x2={-Math.cos(((WIND_POINTS.indexOf(value) * 45 - 90) * Math.PI) / 180) * (R - 24)}
              y2={-Math.sin(((WIND_POINTS.indexOf(value) * 45 - 90) * Math.PI) / 180) * (R - 24)}
              stroke={BRASS}
              strokeWidth={2.4}
            />
          </g>
        ) : (
          <text
            y={4}
            textAnchor="middle"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
            fill={MUTED}
          >
            no wind set
          </text>
        )}
      </svg>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Tap the point the wind is coming <em>from</em>. The shore it is blowing onto is the one that
        collects the drift — and the one that is least pleasant to stand on.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The board                                                           */
/* ------------------------------------------------------------------ */

export function PlanViewBoard({
  waterType,
  level,
  waterbody,
}: {
  waterType: WaterType;
  level: ReadLevel;
  waterbody?: string;
}) {
  const schematic = useMemo(() => schematicFor(waterType), [waterType]);
  const [state, setState] = useState<PlanState>(DEFAULT_PLAN_STATE);
  const [selected, setSelected] = useState<string | null>(null);

  const reads = useMemo(() => readPlan(schematic, level, state), [schematic, level, state]);
  const summary = useMemo(() => planSummary(reads, state), [reads, state]);
  const chosen = reads.find((r) => r.zone.id === selected) ?? null;
  const Base = BASE[schematic.kind];

  const setWater = (water: PlanWaterState) => setState((s) => ({ ...s, water }));
  const setTide = (tide: TideState | null) => setState((s) => ({ ...s, tide }));
  const setWind = (wind: WindPoint | null) => setState((s) => ({ ...s, wind }));

  return (
    <section
      className="rounded-none border border-border bg-card/40 p-4 md:p-6"
      data-testid="plan-view"
    >
      <header className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--brass,#c8a24a)]">
          Plan view · where along the water
        </p>
        <h3 className="mt-1.5 font-display text-xl font-bold uppercase leading-tight tracking-tight md:text-2xl">
          {schematic.title}
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {schematic.caption}
          {waterbody ? (
            <>
              {" "}
              It is a schematic of this <em>class</em> of water, not a survey of {waterbody} — the
              shape of that particular shore is yours to read when you get there.
            </>
          ) : null}
        </p>
      </header>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[560px]"
          role="img"
          aria-label={`${schematic.title}. ${summary}`}
        >
          <Defs />
          <Base />
          {reads.map((read) => {
            const style = EMPHASIS_STYLE[read.emphasis];
            const cx = read.zone.at.x * W;
            const cy = read.zone.at.y * H;
            const r = (read.zone.r ?? 0.05) * W;
            const active = selected === read.zone.id;
            return (
              <g
                key={read.zone.id}
                onClick={() => setSelected(active ? null : read.zone.id)}
                className="cursor-pointer"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={style.fill}
                  fillOpacity={style.opacity}
                  stroke={read.emphasis === "off" ? MUTED : BRASS}
                  strokeWidth={active ? style.stroke + 1.4 : style.stroke}
                  strokeOpacity={read.emphasis === "off" ? 0.4 : 0.9}
                  strokeDasharray={read.emphasis === "off" ? "5 5" : undefined}
                />
                <text
                  x={cx}
                  y={cy + r + 18}
                  textAnchor="middle"
                  fontSize="14"
                  fontFamily="ui-monospace, monospace"
                  fill={read.emphasis === "off" ? MUTED : INK}
                  opacity={read.emphasis === "off" ? 0.5 : 0.92}
                >
                  {read.zone.label}
                </text>
                <title>{`${read.zone.label} — ${read.zone.what}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-3 border-l-2 border-[color:var(--brass,#c8a24a)]/60 pl-3 text-sm leading-relaxed">
        {summary}
      </p>

      {/* ---- controls ---- */}
      <div className="mt-5 grid gap-5 border-t border-border/60 pt-4 lg:grid-cols-[auto_1fr]">
        {schematic.windMatters ? <WindDial value={state.wind} onChange={setWind} /> : <div />}
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Water state
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WATER_STATES.filter((s) => schematic.states.includes(s)).map((s) => (
                <Chip key={s} active={state.water === s} onClick={() => setWater(s)}>
                  {WATER_STATE_LABEL[s]}
                </Chip>
              ))}
            </div>
          </div>
          {schematic.tideMatters ? (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Tide
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TIDES.map((t) => (
                  <Chip
                    key={t}
                    active={state.tide === t}
                    onClick={() => setTide(state.tide === t ? null : t)}
                  >
                    {TIDE_LABEL[t]}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ---- the selected zone, or the list ---- */}
      {chosen ? (
        <div className="mt-5 border-t border-border/60 pt-4" data-testid="plan-zone-detail">
          <h4 className="font-display text-base font-bold uppercase tracking-tight">
            {chosen.zone.label}
          </h4>
          <dl className="mt-2 grid gap-2 text-sm leading-relaxed">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                What it is
              </dt>
              <dd>{chosen.zone.what}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Why fish relate to it
              </dt>
              <dd>{chosen.zone.why}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Finding it with no map
              </dt>
              <dd>{chosen.zone.look}</dd>
            </div>
            {chosen.notes.length ? (
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--brass,#c8a24a)]">
                  Under the conditions you have set
                </dt>
                <dd className="space-y-1">
                  {chosen.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mt-3 min-h-11 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
          >
            ← back to the whole picture
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Tap any marked zone for what it is, why fish relate to it, and how to find it standing
          there with no map. Nothing here says a fish is present — it says the physical reason that
          piece of water is worth a cast, and under which conditions that reason gets stronger or
          stops applying.
        </p>
      )}
    </section>
  );
}
