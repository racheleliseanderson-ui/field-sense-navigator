/**
 * Hook the Horizon — presentation path plate.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk.
 *
 * A presentation family is a name. What matters is the job the thing has to
 * do in the water: how deep, how fast, what path, how long it stays where a
 * fish can decide, and whether it touches anything on the way. Two lures from
 * different aisles can do the same job, and two lures from the same box often
 * do not — which is the whole reason this plate draws the job rather than the
 * lure.
 *
 * Nothing here predicts a bite. It describes a mechanical task, and the
 * reader can hold a lure up against it and see whether it can perform it.
 */

import type { ReactNode } from "react";

import {
  ALARM,
  BRASS,
  Canvas,
  DEPTH_ROWS,
  Flow,
  INK,
  LAND,
  LegendRow,
  MONO,
  MUTED,
  PANEL,
  Plate,
  Span,
  Tag,
  usePlateId,
  WaterField,
  type DepthRowId,
} from "./kit";

export type PathShape =
  "drift" | "swing" | "retrieve" | "jig" | "drop" | "troll" | "surface" | "crawl" | "hold";

export type PathSpeed = "dead" | "slow" | "moderate" | "brisk";
export type PathPause = "none" | "brief" | "long";
export type PathContact = "none" | "occasional" | "constant";
export type StrikeWindow = "short" | "medium" | "long";

export type PresentationJob = {
  /** Which band the presentation has to work in. `varies` is an honest answer. */
  depth: DepthRowId | "varies" | readonly DepthRowId[];
  shape: PathShape;
  speed: PathSpeed;
  pause: PathPause;
  /** Bottom, weed or structure contact. */
  contact: PathContact;
  /** How long the thing stays where a fish can decide about it. */
  strikeWindow: StrikeWindow;
  /** Only meaningful where there is current. */
  current?: "across" | "with" | "against" | "none" | undefined;
  /** Free text: silhouette and size, in the reader's units. */
  profile?: string | undefined;
};

const W = 720;
const H = 300;
const AIR = 40;
const BED = 262;
const COL = BED - AIR;

const BAND_TOP: Record<DepthRowId, number> = {
  film: 0,
  upper: 0.2,
  mid: 0.4,
  "near-bottom": 0.6,
  bottom: 0.8,
};

const SPEED_WORD: Record<PathSpeed, string> = {
  dead: "Dead drift — the water moves it, you do not",
  slow: "Slow — slower than feels productive",
  moderate: "Moderate — steady, coverable",
  brisk: "Brisk — fast enough to trigger or to be refused",
};

const PAUSE_WORD: Record<PathPause, string> = {
  none: "No pause. The path is continuous.",
  brief: "Short pauses. The stop is where most eats happen.",
  long: "Long pauses. Count them; do not guess them.",
};

const CONTACT_WORD: Record<PathContact, string> = {
  none: "No contact. Anything it touches is a mistake.",
  occasional: "Occasional contact — the tick tells you the depth is right.",
  constant: "Constant contact. Lose the bottom and you are fishing nothing.",
};

const WINDOW_WORD: Record<StrikeWindow, string> = {
  short: "Short window. The fish decides in about a second.",
  medium: "Medium window. There is time for a follow.",
  long: "Long window. A fish can look, leave and come back.",
};

function bandCenter(depth: PresentationJob["depth"]): number {
  if (depth === "varies") return 0.5;
  const ids = typeof depth === "string" ? [depth] : [...depth];
  if (!ids.length) return 0.5;
  const mid = ids.map((id) => BAND_TOP[id] + 0.1);
  return mid.reduce((a, b) => a + b, 0) / mid.length;
}

/** Dash length carries speed, so a slow path looks slow without a legend. */
function speedDash(speed: PathSpeed): string | undefined {
  switch (speed) {
    case "dead":
      return "2 9";
    case "slow":
      return "7 8";
    case "moderate":
      return "16 7";
    default:
      return undefined;
  }
}

/**
 * The path itself.
 *
 * `y` is the centre of the working band in viewBox units. Every shape starts
 * at the rod tip on the left and ends where the retrieve ends, so two plates
 * side by side compare honestly.
 */
function pathFor(shape: PathShape, y: number): string {
  const x0 = 46;
  const x1 = W - 40;
  switch (shape) {
    case "drift":
      return `M${x0},${y - 22} C${x0 + 90},${y - 6} ${x0 + 200},${y} ${x1 - 180},${y + 4} L${x1},${y + 12}`;
    case "swing":
      return `M${x0},${AIR + 16} C${x0 + 150},${AIR + 30} ${x0 + 260},${y - 30} ${x0 + 330},${y} C${x0 + 420},${y + 26} ${x1 - 60},${y + 34} ${x1},${y + 30}`;
    case "retrieve":
      return `M${x0},${y} C${x0 + 160},${y - 8} ${x1 - 220},${y + 8} ${x1},${y}`;
    case "jig": {
      const seg: string[] = [`M${x0},${AIR + 12}`];
      let x = x0;
      let cur = AIR + 12;
      const step = (x1 - x0) / 6;
      for (let i = 0; i < 6; i += 1) {
        const down = Math.min(BED - 12, cur + (y - AIR) / 3.2);
        seg.push(`L${x + step * 0.45},${down}`);
        cur = Math.max(y - 34, down - 30);
        seg.push(`L${x + step},${cur}`);
        x += step;
      }
      return seg.join(" ");
    }
    case "drop":
      return `M${x0 + 250},${AIR + 8} C${x0 + 268},${AIR + 60} ${x0 + 240},${y - 30} ${x0 + 258},${y} C${x0 + 272},${y + 30} ${x0 + 248},${BED - 20} ${x0 + 262},${BED - 12}`;
    case "troll":
      return `M${x0},${y - 6} C${x0 + 180},${y + 6} ${x1 - 300},${y - 8} ${x1 - 120},${y + 4} L${x1},${y - 2}`;
    case "surface": {
      const seg: string[] = [`M${x0},${AIR + 6}`];
      const step = (x1 - x0) / 8;
      for (let i = 1; i <= 8; i += 1) {
        seg.push(`L${x0 + step * i - step / 2},${AIR + (i % 2 ? 16 : 2)}`);
        seg.push(`L${x0 + step * i},${AIR + 6}`);
      }
      return seg.join(" ");
    }
    case "hold": {
      /*
       * A bait that sits still is still doing a job, and it is the one job
       * anglers describe as "doing nothing". The line drops to the band and
       * stays there; what moves is the water past it.
       */
      const hx = x0 + 250;
      return `M${hx},${AIR + 4} C${hx + 8},${AIR + 40} ${hx - 6},${y - 40} ${hx + 2},${y} m-16,0 q16,-7 32,0 m-32,10 q16,-7 32,0`;
    }
    case "crawl":
    default:
      return `M${x0},${BED - 46} C${x0 + 140},${BED - 20} ${x0 + 300},${BED - 10} ${x0 + 420},${BED - 16} C${x1 - 120},${BED - 22} ${x1 - 40},${BED - 12} ${x1},${BED - 14}`;
  }
}

const SHAPE_LABEL: Record<PathShape, string> = {
  drift: "Drift",
  swing: "Swing",
  retrieve: "Retrieve",
  jig: "Jig",
  drop: "Vertical drop",
  troll: "Troll",
  surface: "Surface",
  crawl: "Bottom crawl",
  hold: "Held in place",
};

export function PresentationPathPlate({
  job,
  eyebrow = "The job, not the lure",
  title,
  caption,
  aside,
  unknown,
  testid = "presentation-path-plate",
}: {
  job: PresentationJob;
  eyebrow?: string | undefined;
  title: string;
  caption?: string | undefined;
  aside?: ReactNode | undefined;
  unknown?: ReactNode | undefined;
  testid?: string | undefined;
}) {
  const glow = usePlateId("zonewash");
  const centre = bandCenter(job.depth);
  const y = AIR + centre * COL;
  const bandIds: DepthRowId[] =
    job.depth === "varies" ? [] : typeof job.depth === "string" ? [job.depth] : [...job.depth];

  const windowW =
    job.shape === "hold"
      ? W - 120
      : job.strikeWindow === "short"
        ? 90
        : job.strikeWindow === "medium"
          ? 200
          : 330;
  const windowX = job.shape === "drop" || job.shape === "hold" ? 200 : 250;

  return (
    <Plate
      eyebrow={eyebrow}
      title={title}
      caption={caption}
      testid={testid}
      aside={aside}
      unknown={unknown}
      legend={
        <>
          <LegendRow label="Depth" tone="accent">
            {job.depth === "varies"
              ? "Not settled. Find the layer before you argue about anything else."
              : bandIds.map((id) => DEPTH_ROWS.find((r) => r.id === id)?.label ?? id).join(", ")}
          </LegendRow>
          <LegendRow label="Path" tone="ink">
            {SHAPE_LABEL[job.shape]}
            {job.current && job.current !== "none" ? `, ${job.current} the current` : ""}.
          </LegendRow>
          <LegendRow label="Speed" tone="ink">
            {SPEED_WORD[job.speed]}
          </LegendRow>
          <LegendRow label="Pause" tone="ink">
            {PAUSE_WORD[job.pause]}
          </LegendRow>
          <LegendRow label="Contact" tone={job.contact === "constant" ? "watch" : "ink"}>
            {CONTACT_WORD[job.contact]}
          </LegendRow>
          <LegendRow label="Strike window" tone="watch">
            {WINDOW_WORD[job.strikeWindow]}
          </LegendRow>
          {job.profile ? (
            <LegendRow label="Profile" tone="muted">
              {job.profile}
            </LegendRow>
          ) : null}
        </>
      }
    >
      <Canvas
        w={W}
        h={H}
        min={540}
        label={`Path of a ${SHAPE_LABEL[job.shape].toLowerCase()} presentation through the water column`}
      >
        <defs>
          <linearGradient id={glow} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRASS} stopOpacity="0.26" />
            <stop offset="100%" stopColor={BRASS} stopOpacity="0.04" />
          </linearGradient>
        </defs>

        <WaterField x={0} y={AIR} w={W} h={COL} />
        <line x1={0} y1={AIR} x2={W} y2={AIR} stroke={INK} strokeWidth={2} opacity={0.5} />
        <rect x={0} y={BED} width={W} height={H - BED} fill={LAND} />
        <line x1={0} y1={BED} x2={W} y2={BED} stroke={MUTED} strokeWidth={1.2} />

        {/* Depth ladder down the left edge — the reference every band reads against. */}
        {DEPTH_ROWS.map((row, i) => {
          const ry = AIR + (i / DEPTH_ROWS.length) * COL;
          const rh = COL / DEPTH_ROWS.length;
          const on = bandIds.includes(row.id);
          return (
            <g key={row.id}>
              {on ? <rect x={0} y={ry} width={W} height={rh} fill={`url(#${glow})`} /> : null}
              <line x1={0} y1={ry} x2={W} y2={ry} stroke={PANEL} strokeWidth={0.7} opacity={0.6} />
              <text
                x={8}
                y={ry + rh / 2 + 4}
                fontSize={9.5}
                fill={on ? BRASS : MUTED}
                fontFamily={MONO}
                letterSpacing="0.1em"
              >
                {row.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {job.current && job.current !== "none" ? (
          <Flow
            x={40}
            y={AIR + 18}
            w={W - 60}
            rows={4}
            gap={54}
            speed={job.speed === "brisk" ? 3 : job.speed === "dead" ? 1 : 2}
            opacity={0.24}
          />
        ) : null}

        {job.contact !== "none" ? (
          <g opacity={job.contact === "constant" ? 0.9 : 0.5}>
            {Array.from({ length: job.contact === "constant" ? 16 : 6 }, (_, i) => {
              const cx = 70 + i * ((W - 130) / (job.contact === "constant" ? 15 : 5));
              return (
                <line
                  key={i}
                  x1={cx}
                  y1={BED - 6}
                  x2={cx}
                  y2={BED - 18}
                  stroke={BRASS}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        ) : null}

        {/* Where a fish can actually decide. Shaded, then measured. */}
        <rect x={windowX} y={AIR} width={windowW} height={COL} fill={BRASS} opacity={0.09} />
        {/* The bracket sits above the surface line rather than on it. */}
        <Span
          from={windowX}
          to={windowX + windowW}
          y={AIR - 12}
          label={`${job.strikeWindow} strike window`}
          tone="watch"
        />

        {/* The path. */}
        <path
          d={pathFor(job.shape, y)}
          fill="none"
          stroke={INK}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={speedDash(job.speed)}
        />

        {/* Pause marks sit on the path where the stop happens. */}
        {job.pause !== "none" ? (
          <g>
            {[0.32, 0.58, 0.82].slice(0, job.pause === "long" ? 3 : 2).map((f) => {
              const px = 46 + f * (W - 86);
              return (
                <g key={f}>
                  <circle
                    cx={px}
                    cy={y}
                    r={job.pause === "long" ? 7 : 5}
                    fill={ALARM}
                    opacity={0.85}
                  />
                  <circle
                    cx={px}
                    cy={y}
                    r={job.pause === "long" ? 12 : 9}
                    fill="none"
                    stroke={ALARM}
                    strokeWidth={1.1}
                    opacity={0.5}
                  />
                </g>
              );
            })}
            <Tag x={W - 10} y={BED - 8} anchor="end" tone="alarm">
              {job.pause === "long" ? "Long pause" : "Pause"}
            </Tag>
          </g>
        ) : null}

        {/* Rod tip, so the path has an origin the reader recognises. */}
        <line
          x1={18}
          y1={AIR - 26}
          x2={46}
          y2={AIR - 2}
          stroke={INK}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <Tag x={10} y={AIR - 32} tone="muted">
          Rod tip
        </Tag>
      </Canvas>
    </Plate>
  );
}

/** Kept for callers that want to describe the job without drawing it. */
export function describeJob(job: PresentationJob): string {
  const where =
    job.depth === "varies"
      ? "at a depth still to be found"
      : `in the ${(typeof job.depth === "string" ? [job.depth] : [...job.depth])
          .map((id) => DEPTH_ROWS.find((r) => r.id === id)?.label.toLowerCase() ?? id)
          .join(" and ")}`;
  return `${SHAPE_LABEL[job.shape]} ${where}, ${job.speed}, ${job.pause === "none" ? "no pause" : `${job.pause} pause`}, ${job.contact} contact.`;
}
