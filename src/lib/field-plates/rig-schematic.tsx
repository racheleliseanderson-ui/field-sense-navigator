/**
 * Hook the Horizon — rig schematic plate.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk.
 *
 * A rig described in a list is a shopping list. A rig drawn to scale is a
 * machine you can argue with: you can see that the dropper is long enough to
 * wrap the main line, that the weight sits above the bait instead of below
 * it, that eighteen inches of leader will not reach the band you said you
 * were fishing.
 *
 * Spacing is drawn to scale against the stated total, so a change to one
 * measurement visibly moves everything below it. That is the whole point —
 * a rig is one assembly, not seven independent choices.
 */

import type { ReactNode } from "react";

import {
  Canvas,
  DEEP,
  FailureMark,
  INK,
  LAND,
  LegendRow,
  MONO,
  MUTED,
  PAPER,
  Plate,
  Span,
  Tag,
  usePlateId,
  toneColor,
  type Tone,
} from "./kit";

export type RigPartKind =
  "knot" | "swivel" | "weight" | "float" | "bead" | "stop" | "hook" | "fly" | "lure" | "dropper";

export type RigRisk = "tangle" | "snag" | "abrasion" | "interference";

export type RigPart = {
  id: string;
  kind: RigPartKind;
  label: string;
  /** Distance from the top of the rig, in the same unit as `totalLength`. */
  at: number;
  /** Only for droppers: how far the tag hangs off the main path. */
  tagLength?: number | undefined;
  note?: string | undefined;
  risk?: RigRisk | null | undefined;
};

export type RigSchematicSpec = {
  /** What this arrangement is supposed to make the bait or lure do. */
  job?: string | undefined;
  /** Total drawn length, top of rig to terminal end. */
  totalLength: number;
  unit: string;
  parts: RigPart[];
  /** Where the surface sits along the rig, if the rig hangs through it. */
  surfaceAt?: number | null | undefined;
  /** Where the bottom sits, if the rig is meant to reach it. */
  bottomAt?: number | null | undefined;
};

const W = 560;
const H = 420;
const AXIS = 168;
const TOP = 44;
const BOTTOM = H - 34;

const RISK_WORD: Record<RigRisk, string> = {
  tangle: "Tangles here first",
  snag: "This is what catches the bottom",
  abrasion: "Wears here",
  interference: "This fights the presentation",
};

export function RigSchematicPlate({
  spec,
  eyebrow = "Rig architecture",
  title,
  caption,
  aside,
  unknown,
  testid = "rig-schematic-plate",
}: {
  spec: RigSchematicSpec;
  eyebrow?: string | undefined;
  title: string;
  caption?: string | undefined;
  aside?: ReactNode | undefined;
  unknown?: ReactNode | undefined;
  testid?: string | undefined;
}) {
  const clipId = usePlateId("rigwater");
  const total = Math.max(spec.totalLength, 1);
  const yOf = (v: number) => TOP + (Math.max(0, Math.min(total, v)) / total) * (BOTTOM - TOP);
  const parts = [...spec.parts].sort((a, b) => a.at - b.at);
  const risky = parts.filter((p) => p.risk);

  return (
    <Plate
      eyebrow={eyebrow}
      title={title}
      caption={caption ?? (spec.job ? `What it has to do: ${spec.job}` : undefined)}
      testid={testid}
      aside={aside}
      unknown={unknown}
      inputs={[
        { label: "Drawn length", value: `${spec.totalLength}${spec.unit}`, source: "stated" },
        { label: "Components placed", value: String(parts.length), source: "stated" },
        {
          label: "Surface at",
          value: typeof spec.surfaceAt === "number" ? `${spec.surfaceAt}${spec.unit}` : "not drawn",
          source: typeof spec.surfaceAt === "number" ? "stated" : "assumed",
        },
        {
          label: "Bottom at",
          value: typeof spec.bottomAt === "number" ? `${spec.bottomAt}${spec.unit}` : "not drawn",
          source: typeof spec.bottomAt === "number" ? "stated" : "assumed",
        },
        {
          label: "Spacing between components",
          value: "drawn to scale from the stated positions",
        },
        {
          label: "Flagged for failure",
          value: risky.length ? risky.map((p) => p.label).join(", ") : "none flagged",
        },
      ]}
      legend={
        <>
          {parts.map((p, i) => (
            <LegendRow
              key={p.id}
              n={i + 1}
              label={`${p.label} — ${p.at}${spec.unit}`}
              tone={p.risk ? "watch" : "accent"}
            >
              {p.note ?? ""}
              {p.risk ? ` ${RISK_WORD[p.risk]}.` : ""}
            </LegendRow>
          ))}
          {risky.length === 0 ? (
            <LegendRow label="Failure points" tone="steady">
              Nothing in this arrangement is flagged. That is not the same as nothing going wrong.
            </LegendRow>
          ) : null}
        </>
      }
    >
      <Canvas
        w={W}
        h={H}
        min={420}
        label={`Rig schematic, ${total}${spec.unit} from top to terminal end`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={0}
              y={typeof spec.surfaceAt === "number" ? yOf(spec.surfaceAt) : TOP}
              width={W}
              height={H}
            />
          </clipPath>
        </defs>

        {typeof spec.surfaceAt === "number" ? (
          <>
            <rect
              x={0}
              y={yOf(spec.surfaceAt)}
              width={W}
              height={BOTTOM - yOf(spec.surfaceAt) + 34}
              fill={DEEP}
            />
            <line
              x1={0}
              y1={yOf(spec.surfaceAt)}
              x2={W}
              y2={yOf(spec.surfaceAt)}
              stroke={INK}
              strokeWidth={2}
              opacity={0.5}
            />
            <Tag x={W - 10} y={yOf(spec.surfaceAt) - 8} anchor="end" tone="muted">
              Surface
            </Tag>
          </>
        ) : null}

        {typeof spec.bottomAt === "number" ? (
          <>
            <rect
              x={0}
              y={yOf(spec.bottomAt)}
              width={W}
              height={H - yOf(spec.bottomAt)}
              fill={LAND}
            />
            <line
              x1={0}
              y1={yOf(spec.bottomAt)}
              x2={W}
              y2={yOf(spec.bottomAt)}
              stroke={MUTED}
              strokeWidth={1.3}
            />
            <Tag x={W - 10} y={yOf(spec.bottomAt) + 16} anchor="end" tone="muted">
              Bottom
            </Tag>
          </>
        ) : null}

        {/* The line path itself. */}
        <line x1={AXIS} y1={TOP} x2={AXIS} y2={BOTTOM} stroke={INK} strokeWidth={2} />
        <Tag x={AXIS - 8} y={TOP - 12} anchor="end" tone="accent">
          From the rod
        </Tag>

        {/* Measured spacing down the left, so a change to one gap moves the rest. */}
        {parts.map((p, i) => {
          const prev = i === 0 ? 0 : (parts[i - 1]?.at ?? 0);
          if (p.at - prev < total * 0.06) return null;
          return (
            <g key={`span-${p.id}`} transform={`rotate(-90 ${58} ${(yOf(prev) + yOf(p.at)) / 2})`}>
              <Span
                from={58 - (yOf(p.at) - yOf(prev)) / 2}
                to={58 + (yOf(p.at) - yOf(prev)) / 2}
                y={(yOf(prev) + yOf(p.at)) / 2}
                label={`${Math.round((p.at - prev) * 10) / 10}${spec.unit}`}
              />
            </g>
          );
        })}

        {/*
          Labels are laid out separately from the glyphs.

          A three-way swivel and its weight dropper start at the same
          measurement, and two rigs in the catalogue put a hook and a weight an
          inch apart. Drawn at their true positions the labels printed straight
          through each other and the plate became unreadable at exactly the
          point it was carrying the most information. The glyph stays where the
          measurement puts it; the label slides down until it has room and a
          leader line says which glyph it belongs to.
        */}
        {(() => {
          const MIN_GAP = 30;
          let lastLabelY = -Infinity;
          return parts.map((p, i) => {
            const y = yOf(p.at);
            const labelY = Math.max(y, lastLabelY + MIN_GAP);
            lastLabelY = labelY;
            return (
              <RigGlyph
                key={p.id}
                part={p}
                n={i + 1}
                x={AXIS}
                y={y}
                labelY={labelY}
                unit={spec.unit}
                scale={(BOTTOM - TOP) / total}
              />
            );
          });
        })()}
      </Canvas>
    </Plate>
  );
}

function RigGlyph({
  part,
  n,
  x,
  y,
  labelY,
  unit,
  scale,
}: {
  part: RigPart;
  n: number;
  x: number;
  /** Where the component actually sits, to scale. */
  y: number;
  /** Where its label sits, after collision avoidance. */
  labelY: number;
  unit: string;
  scale: number;
}) {
  const tone: Tone = part.risk ? "watch" : "accent";
  const c = toneColor(tone);
  const moved = Math.abs(labelY - y) > 2;
  return (
    <g>
      <Shape kind={part.kind} x={x} y={y} c={c} tagLength={part.tagLength} scale={scale} />
      {part.risk ? <FailureMark x={x + 24} y={y} scale={0.62} tone="watch" /> : null}
      {moved ? (
        <path
          d={`M${x + 14},${y} L${x + 38},${labelY}`}
          fill="none"
          stroke={c}
          strokeWidth={1}
          opacity={0.6}
        />
      ) : null}
      <circle cx={x + 54} cy={labelY} r={10} fill={c} stroke={PAPER} strokeWidth={1.3} />
      <text
        x={x + 54}
        y={labelY + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={PAPER}
        fontFamily={MONO}
      >
        {n}
      </text>
      <text x={x + 72} y={labelY + 4} fontSize={11} fill={INK} fontFamily={MONO}>
        {part.label}
      </text>
      <text
        x={x + 72}
        y={labelY + 17}
        fontSize={9}
        fill={MUTED}
        fontFamily={MONO}
        letterSpacing="0.1em"
      >
        {`${part.at}${unit}`.toUpperCase()}
      </text>
    </g>
  );
}

function Shape({
  kind,
  x,
  y,
  c,
  tagLength,
  scale,
}: {
  kind: RigPartKind;
  x: number;
  y: number;
  c: string;
  tagLength?: number | undefined;
  scale: number;
}) {
  switch (kind) {
    case "weight":
      return <ellipse cx={x} cy={y} rx={7} ry={11} fill={c} />;
    case "float":
      return (
        <g>
          <ellipse cx={x} cy={y} rx={9} ry={14} fill={PAPER} stroke={c} strokeWidth={2} />
          <line x1={x} y1={y - 14} x2={x} y2={y + 14} stroke={c} strokeWidth={1.4} />
        </g>
      );
    case "swivel":
      return (
        <g stroke={c} strokeWidth={2} fill="none">
          <circle cx={x} cy={y - 5} r={4.5} />
          <circle cx={x} cy={y + 5} r={4.5} />
        </g>
      );
    case "bead":
      return <circle cx={x} cy={y} r={5.5} fill={c} />;
    case "stop":
      return <rect x={x - 4} y={y - 3} width={8} height={6} fill={c} />;
    case "knot":
      return (
        <g stroke={c} strokeWidth={2} fill="none">
          <path d={`M${x - 7},${y - 4} q7,-6 14,0 q-7,10 -14,0`} />
        </g>
      );
    case "hook":
      return (
        <path
          d={`M${x},${y - 12} L${x},${y + 4} q0,10 9,10 q9,0 9,-9 l-4,4`}
          fill="none"
          stroke={c}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      );
    case "fly":
      return (
        <g>
          <path
            d={`M${x},${y - 10} L${x},${y + 2} q0,9 8,9 q8,0 8,-8`}
            fill="none"
            stroke={c}
            strokeWidth={2}
          />
          <path d={`M${x - 6},${y - 8} q10,-6 18,-1`} fill="none" stroke={c} strokeWidth={1.6} />
        </g>
      );
    case "lure":
      return <path d={`M${x - 10},${y} q10,-11 22,0 q-12,11 -22,0`} fill={c} opacity={0.85} />;
    case "dropper": {
      const len = Math.max(18, (tagLength ?? 6) * scale);
      return (
        <g>
          <path
            d={`M${x},${y} q-16,${len * 0.55} -26,${len}`}
            fill="none"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <circle cx={x - 26} cy={y + len} r={4} fill={c} />
        </g>
      );
    }
    default:
      return <circle cx={x} cy={y} r={5} fill={c} />;
  }
}
