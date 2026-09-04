/**
 * Hook the Horizon — connection load plate.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk.
 *
 * Knot diagrams almost always show the tying and stop there, which teaches
 * the hands and tells the reader nothing about why the thing came undone at
 * the boat. This plate draws the other half: where the load concentrates,
 * which of the two materials is carrying it, and whether the failure people
 * are describing is a slip or a break. Those are different problems with
 * different fixes, and they get confused constantly.
 */

import type { ReactNode } from "react";

import {
  ALARM,
  Arrow,
  BRASS,
  Canvas,
  FailureMark,
  INK,
  LegendRow,
  MONO,
  PAPER,
  Plate,
  STEADY,
  Tag,
  WATCH,
  usePlateId,
} from "./kit";

export type LineMaterial =
  "mono" | "fluoro" | "braid" | "wire" | "backing" | "fly-line" | "unknown";

export type FailureMode = "slip" | "break" | "holds" | "unknown";

export type ConnectionSide = {
  label: string;
  material: LineMaterial;
  /** As the reader states it: "20 lb", "0.011 in", "3X". */
  gauge?: string | undefined;
  /** Relative thickness for drawing, 1 to 6. */
  weight?: number | undefined;
};

export type LoadPathSpec = {
  a: ConnectionSide;
  b: ConnectionSide;
  /** Where load concentrates along the connection, 0 to 1. */
  stressAt?: number[] | undefined;
  mode: FailureMode;
  /** Turns, wraps or passes — whatever the connection counts. */
  turns?: number | null | undefined;
  /** How far apart the two materials are. Null when it has not been worked out. */
  mismatch?: "matched" | "workable" | "far apart" | null | undefined;
  /** One sentence naming what actually gives. */
  verdict?: string | undefined;
};

const W = 640;
const H = 206;
const MID = 96;

/**
 * What the material does to a connection. Deliberately does not restate the
 * material's name — the legend row is already headed with it, and "Braid —
 * braid: no stretch" is the kind of doubling that makes a reader stop reading
 * legends.
 */
const MATERIAL_WORD: Record<LineMaterial, string> = {
  mono: "Stretches, grips a knot, forgives a little slack.",
  fluoro: "Stiffer and slicker than mono, and less forgiving of a hurried cinch.",
  braid: "No stretch and slippery. Most connection failures in it are slips rather than breaks.",
  wire: "Will not knot like line. It needs a connection built for it.",
  backing: "Rarely the weak link. Occasionally the forgotten one.",
  "fly-line": "A coated core — the connection is to the core, not to the coating.",
  unknown: "Material not stated, which changes what can be said about it.",
};

const MODE_WORD: Record<FailureMode, string> = {
  slip: "It slips. The connection pulls through rather than parting — more turns, a wetter cinch, or a different connection for this material.",
  break:
    "It breaks. The line parts at the load point — the material is at its limit, or the cinch damaged it.",
  holds: "It holds under the load described here.",
  unknown:
    "Not enough to say which. Slip and break need different fixes, so it is worth finding out which one you had.",
};

function strokeFor(side: ConnectionSide): number {
  if (side.weight) return Math.max(1.5, Math.min(9, side.weight * 1.4));
  switch (side.material) {
    case "braid":
      return 2.2;
    case "wire":
      return 2.8;
    case "fly-line":
      return 8;
    case "backing":
      return 2;
    default:
      return 4;
  }
}

function dashFor(material: LineMaterial): string | undefined {
  if (material === "braid") return "9 3";
  if (material === "wire") return "2 3";
  return undefined;
}

export function LoadPathPlate({
  spec,
  eyebrow = "Where the load goes",
  title,
  caption,
  aside,
  unknown,
  testid = "load-path-plate",
}: {
  spec: LoadPathSpec;
  eyebrow?: string | undefined;
  title: string;
  caption?: string | undefined;
  aside?: ReactNode | undefined;
  unknown?: ReactNode | undefined;
  testid?: string | undefined;
}) {
  const heat = usePlateId("loadheat");
  /*
   * At least one stress point, always. A connection drawn with no load
   * concentration anywhere is a picture of a knot rather than a diagnosis.
   */
  const stress: number[] = spec.stressAt?.length ? spec.stressAt : [0.5];
  const firstStress = stress[0] ?? 0.5;
  const knotX = W / 2;
  const turnCount = Math.max(2, Math.min(9, spec.turns ?? 5));

  return (
    <Plate
      eyebrow={eyebrow}
      title={title}
      caption={caption}
      testid={testid}
      aside={aside}
      unknown={unknown}
      inputs={[
        {
          label: spec.a.label,
          value: `${MATERIAL_WORD[spec.a.material]}${spec.a.gauge ? `, ${spec.a.gauge}` : ""}`,
          source: "stated",
        },
        {
          label: spec.b.label,
          value: `${MATERIAL_WORD[spec.b.material]}${spec.b.gauge ? `, ${spec.b.gauge}` : ""}`,
          source: "stated",
        },
        {
          label: "Turns counted",
          value: typeof spec.turns === "number" ? String(spec.turns) : "not counted",
          source: typeof spec.turns === "number" ? "stated" : "assumed",
        },
        {
          label: "How far apart the two materials are",
          value: spec.mismatch ?? "not worked out",
          source: spec.mismatch ? "stated" : "assumed",
        },
        {
          label: "Stress drawn at",
          value: (spec.stressAt ?? []).length
            ? (spec.stressAt ?? []).map((v) => `${Math.round(v * 100)}%`).join(", ")
            : "no concentration drawn",
        },
        { label: "What gives", value: spec.verdict ?? MODE_WORD[spec.mode] },
      ]}
      legend={
        <>
          <LegendRow label={spec.a.label} tone="ink">
            {MATERIAL_WORD[spec.a.material]}
            {spec.a.gauge ? ` (${spec.a.gauge})` : ""}.
          </LegendRow>
          <LegendRow label={spec.b.label} tone="ink">
            {MATERIAL_WORD[spec.b.material]}
            {spec.b.gauge ? ` (${spec.b.gauge})` : ""}.
          </LegendRow>
          {spec.mismatch ? (
            <LegendRow
              label="Diameter"
              tone={
                spec.mismatch === "far apart"
                  ? "alarm"
                  : spec.mismatch === "workable"
                    ? "watch"
                    : "steady"
              }
            >
              {spec.mismatch === "far apart"
                ? "Far apart. A connection that works at matched diameters can bite through the thinner side here."
                : spec.mismatch === "workable"
                  ? "Workable, with attention to how the thinner side seats."
                  : "Close enough that the connection behaves the way it is described."}
            </LegendRow>
          ) : null}
          <LegendRow
            label="What gives"
            tone={spec.mode === "holds" ? "steady" : spec.mode === "unknown" ? "muted" : "alarm"}
          >
            {spec.verdict ?? MODE_WORD[spec.mode]}
          </LegendRow>
        </>
      }
    >
      <Canvas
        w={W}
        h={H}
        min={480}
        label={`Load path through a ${spec.a.label} to ${spec.b.label} connection`}
      >
        <defs>
          <radialGradient id={heat}>
            <stop offset="0%" stopColor={ALARM} stopOpacity="0.5" />
            <stop offset="70%" stopColor={ALARM} stopOpacity="0.12" />
            <stop offset="100%" stopColor={ALARM} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The two materials, drawn at their real relative weight. */}
        <line
          x1={30}
          y1={MID}
          x2={knotX - 34}
          y2={MID}
          stroke={INK}
          strokeWidth={strokeFor(spec.a)}
          strokeDasharray={dashFor(spec.a.material)}
          strokeLinecap="round"
        />
        <line
          x1={knotX + 34}
          y1={MID}
          x2={W - 30}
          y2={MID}
          stroke={INK}
          strokeWidth={strokeFor(spec.b)}
          strokeDasharray={dashFor(spec.b.material)}
          strokeLinecap="round"
        />

        {/* The connection body. Turns are counted, not decorated. */}
        <g>
          <rect
            x={knotX - 34}
            y={MID - 22}
            width={68}
            height={44}
            rx={8}
            fill={PAPER}
            stroke={BRASS}
            strokeWidth={1.8}
          />
          {Array.from({ length: turnCount }, (_unused, i) => {
            const wx = knotX - 26 + (i * 52) / Math.max(1, turnCount - 1);
            return (
              <path
                key={i}
                d={`M${wx},${MID - 16} q6,${16} 0,${32}`}
                fill="none"
                stroke={BRASS}
                strokeWidth={1.5}
                opacity={0.85}
              />
            );
          })}
          <Tag x={knotX} y={MID - 30} anchor="middle" tone="accent">
            {typeof spec.turns === "number" ? `${spec.turns} turns` : "Connection"}
          </Tag>
        </g>

        {/* Stress concentration. */}
        {stress.map((s, i) => {
          const sx = 30 + s * (W - 60);
          return (
            <g key={i}>
              <circle cx={sx} cy={MID} r={40} fill={`url(#${heat})`} />
              <circle cx={sx} cy={MID} r={6} fill={ALARM} opacity={0.9} />
            </g>
          );
        })}

        {/* Load, pulling both ways. A connection is only interesting under tension. */}
        <Arrow from={[128, MID + 58]} to={[34, MID + 58]} tone="muted" width={1.4} label="Load" />
        <Arrow
          from={[W - 128, MID + 58]}
          to={[W - 34, MID + 58]}
          tone="muted"
          width={1.4}
          label="Load"
        />

        {/* The failure, placed where it happens. */}
        {spec.mode === "slip" ? (
          <g>
            <Arrow
              from={[knotX + 6, MID - 44]}
              to={[knotX + 52, MID - 44]}
              tone="alarm"
              width={2}
            />
            <text
              x={knotX + 58}
              y={MID - 40}
              fontSize={10.5}
              fill={ALARM}
              fontFamily={MONO}
              letterSpacing="0.12em"
            >
              PULLS THROUGH
            </text>
          </g>
        ) : null}
        {spec.mode === "break" ? (
          <g>
            <FailureMark x={firstStress * (W - 60) + 30} y={MID} scale={1.15} />
            <text
              x={firstStress * (W - 60) + 30}
              y={MID + 44}
              textAnchor="middle"
              fontSize={10.5}
              fill={ALARM}
              fontFamily={MONO}
              letterSpacing="0.12em"
            >
              PARTS HERE
            </text>
          </g>
        ) : null}
        {spec.mode === "holds" ? (
          <text
            x={knotX}
            y={MID + 62}
            textAnchor="middle"
            fontSize={10.5}
            fill={STEADY}
            fontFamily={MONO}
            letterSpacing="0.12em"
          >
            HOLDS UNDER THIS LOAD
          </text>
        ) : null}
        {spec.mode === "unknown" ? (
          <text
            x={knotX}
            y={MID + 62}
            textAnchor="middle"
            fontSize={10.5}
            fill={WATCH}
            fontFamily={MONO}
            letterSpacing="0.12em"
          >
            SLIP OR BREAK NOT ESTABLISHED
          </text>
        ) : null}

        <Tag x={30} y={MID - 22} tone="muted">
          {spec.a.label}
        </Tag>
        <Tag x={W - 30} y={MID - 22} anchor="end" tone="muted">
          {spec.b.label}
        </Tag>
      </Canvas>
    </Plate>
  );
}
