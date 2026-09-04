/**
 * Hook the Horizon — thermal band plate.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk.
 *
 * Temperature is the single number that moves a fishing decision most, and it
 * is almost always presented as a sentence: "prefers 65–72°F". That sentence
 * hides three things a reader needs. Where the number you measured sits
 * against it. How wide the merely-active range is either side of the
 * preferred core. And whether the range describes what the fish *prefers* or
 * only where it has been *found* — which sources conflate constantly and
 * anglers read very differently.
 *
 * So the plate draws all three, and draws the absence of them when a species
 * has no reviewed band. An empty axis labelled "no reviewed band" is a better
 * answer than a plausible-looking range nobody published.
 */

import type { ReactNode } from "react";

import {
  ALARM,
  BRASS,
  Canvas,
  INK,
  LegendRow,
  MONO,
  MUTED,
  PANEL,
  PAPER,
  Plate,
  STEADY,
  Tag,
  WATCH,
} from "./kit";

export type ThermalBasis = "preference" | "distribution" | "mixed";

export type ThermalBandSpec = {
  /** Below this the fish is reported inactive, avoiding, or cold-stressed. */
  coldEdgeF?: number | null | undefined;
  /** Reported active and feeding across this range. */
  activeF?: [number, number] | null | undefined;
  /** The sourced preference or optimum. */
  preferredF?: [number, number] | null | undefined;
  /** The same as coldEdge, at the top. */
  warmEdgeF?: number | null | undefined;
  /** What the angler actually has: a reading, or a range they are working in. */
  observedF?: number | [number, number] | null | undefined;
  observedLabel?: string | undefined;
  /** Whether the numbers describe preference or only distribution. */
  basis?: ThermalBasis | null | undefined;
  /** The source's own caveat, when it has one worth showing. */
  note?: string | undefined;
};

const W = 700;
const H = 190;
const LEFT = 46;
const RIGHT = W - 30;
const AXIS_Y = 118;
const BAR_H = 46;

const BASIS_WORD: Record<ThermalBasis, string> = {
  preference:
    "A measured preference. The fish chooses this range when it can, which is the kind of number worth planning around.",
  distribution:
    "From where the species is found, not a measured preference. It tells you where the fish lives, not where it would rather be — a weaker claim than it looks.",
  mixed: "Preference and distribution data mixed. Treat the edges as softer than the core.",
};

export function ThermalBandPlate({
  spec,
  eyebrow = "Temperature",
  title,
  caption,
  aside,
  testid = "thermal-band-plate",
}: {
  spec: ThermalBandSpec;
  eyebrow?: string | undefined;
  title: string;
  caption?: string | undefined;
  aside?: ReactNode | undefined;
  testid?: string | undefined;
}) {
  const marks: number[] = [];
  const push = (v: number | null | undefined) => {
    if (typeof v === "number" && Number.isFinite(v)) marks.push(v);
  };
  push(spec.coldEdgeF);
  push(spec.warmEdgeF);
  if (spec.activeF) marks.push(...spec.activeF);
  if (spec.preferredF) marks.push(...spec.preferredF);
  if (typeof spec.observedF === "number") marks.push(spec.observedF);
  else if (Array.isArray(spec.observedF)) marks.push(...spec.observedF);

  const hasBand = Boolean(
    spec.activeF || spec.preferredF || spec.coldEdgeF != null || spec.warmEdgeF != null,
  );
  const lo = marks.length ? Math.floor(Math.min(...marks) - 6) : 32;
  const hi = marks.length ? Math.ceil(Math.max(...marks) + 6) : 86;
  const x = (f: number) => LEFT + ((f - lo) / Math.max(1, hi - lo)) * (RIGHT - LEFT);

  const observed =
    typeof spec.observedF === "number"
      ? ([spec.observedF, spec.observedF] as [number, number])
      : Array.isArray(spec.observedF)
        ? spec.observedF
        : null;

  /** Ticks at whole multiples of five, so the axis is readable rather than exact. */
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / 5) * 5; t <= hi; t += 5) ticks.push(t);

  return (
    <Plate
      eyebrow={eyebrow}
      title={title}
      caption={caption}
      testid={testid}
      aside={aside}
      inputs={[
        {
          label: "Reading you have",
          value:
            spec.observedF == null
              ? "none"
              : Array.isArray(spec.observedF)
                ? `${spec.observedF[0]}–${spec.observedF[1]}°F`
                : `${spec.observedF}°F`,
          source: spec.observedF == null ? "assumed" : "measured",
        },
        {
          label: "Active range",
          value: spec.activeF ? `${spec.activeF[0]}–${spec.activeF[1]}°F` : "none published",
        },
        {
          label: "Preferred range",
          value: spec.preferredF
            ? `${spec.preferredF[0]}–${spec.preferredF[1]}°F`
            : "none published",
        },
        {
          label: "Cold edge",
          value: typeof spec.coldEdgeF === "number" ? `${spec.coldEdgeF}°F` : "not published",
        },
        {
          label: "Warm edge",
          value: typeof spec.warmEdgeF === "number" ? `${spec.warmEdgeF}°F` : "not published",
        },
        {
          label: "What the numbers describe",
          value: spec.basis ?? "not stated by the source",
          source: spec.basis ? "stated" : "assumed",
        },
      ]}
      unknown={
        hasBand
          ? undefined
          : "No reviewed thermal band exists for this species. The temperature you measured is real; what is missing is anything published to compare it against, so temperature does not move this reading either way."
      }
      legend={
        <>
          {spec.preferredF ? (
            <LegendRow
              label={`Preferred ${spec.preferredF[0]}–${spec.preferredF[1]}°F`}
              tone="steady"
            >
              The core. Where the reviewed record says this fish would rather be.
            </LegendRow>
          ) : null}
          {spec.activeF ? (
            <LegendRow label={`Active ${spec.activeF[0]}–${spec.activeF[1]}°F`} tone="watch">
              Feeding happens across this range. Wider than the core, and the edges are where a day
              gets difficult rather than impossible.
            </LegendRow>
          ) : null}
          {spec.coldEdgeF != null || spec.warmEdgeF != null ? (
            <LegendRow label="Edges" tone="alarm">
              {spec.coldEdgeF != null ? `Cold side from ${spec.coldEdgeF}°F down. ` : ""}
              {spec.warmEdgeF != null ? `Warm or stressed from ${spec.warmEdgeF}°F up. ` : ""}
              Outside the edges the fish is still there — it is just doing something other than
              feeding where you can reach it.
            </LegendRow>
          ) : null}
          {observed ? (
            <LegendRow label={spec.observedLabel ?? "What you have"} tone="accent">
              {observed[0] === observed[1]
                ? `${observed[0]}°F.`
                : `${observed[0]}–${observed[1]}°F — a range, so the reading holds back a single thermal bias rather than inventing a midpoint.`}
            </LegendRow>
          ) : (
            <LegendRow label="What you have" tone="muted">
              No water temperature entered. This is the single measurement that moves the reading
              most, and a cheap thermometer beats a forecast every time.
            </LegendRow>
          )}
          {spec.basis ? (
            <LegendRow label="What kind of number this is" tone="muted">
              {BASIS_WORD[spec.basis]}
            </LegendRow>
          ) : null}
          {spec.note ? (
            <LegendRow label="From the source" tone="muted">
              {spec.note}
            </LegendRow>
          ) : null}
        </>
      }
    >
      <Canvas w={W} h={H} min={480} label={`Reviewed temperature bands for ${title}`}>
        {/* Cold and warm ends, drawn as the whole remaining axis rather than a stub. */}
        {spec.coldEdgeF != null ? (
          <rect
            x={LEFT}
            y={AXIS_Y - BAR_H}
            width={Math.max(0, x(spec.coldEdgeF) - LEFT)}
            height={BAR_H}
            fill={ALARM}
            opacity={0.12}
          />
        ) : null}
        {spec.warmEdgeF != null ? (
          <rect
            x={x(spec.warmEdgeF)}
            y={AXIS_Y - BAR_H}
            width={Math.max(0, RIGHT - x(spec.warmEdgeF))}
            height={BAR_H}
            fill={ALARM}
            opacity={0.12}
          />
        ) : null}

        {spec.activeF ? (
          <rect
            x={x(spec.activeF[0])}
            y={AXIS_Y - BAR_H}
            width={Math.max(2, x(spec.activeF[1]) - x(spec.activeF[0]))}
            height={BAR_H}
            fill={WATCH}
            opacity={0.2}
            stroke={WATCH}
            strokeWidth={1.2}
          />
        ) : null}

        {spec.preferredF ? (
          <rect
            x={x(spec.preferredF[0])}
            y={AXIS_Y - BAR_H + 8}
            width={Math.max(2, x(spec.preferredF[1]) - x(spec.preferredF[0]))}
            height={BAR_H - 16}
            fill={STEADY}
            opacity={0.34}
            stroke={STEADY}
            strokeWidth={1.6}
          />
        ) : null}

        {!hasBand ? (
          <>
            <rect
              x={LEFT}
              y={AXIS_Y - BAR_H}
              width={RIGHT - LEFT}
              height={BAR_H}
              fill="none"
              stroke={PANEL}
              strokeWidth={1.2}
              strokeDasharray="8 7"
            />
            <text
              x={(LEFT + RIGHT) / 2}
              y={AXIS_Y - BAR_H / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              fill={MUTED}
              fontFamily={MONO}
              letterSpacing="0.13em"
            >
              NO REVIEWED BAND FOR THIS SPECIES
            </text>
          </>
        ) : null}

        {/* Axis. */}
        <line x1={LEFT} y1={AXIS_Y} x2={RIGHT} y2={AXIS_Y} stroke={INK} strokeWidth={1.5} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={AXIS_Y} x2={x(t)} y2={AXIS_Y + 6} stroke={MUTED} strokeWidth={1} />
            <text
              x={x(t)}
              y={AXIS_Y + 19}
              textAnchor="middle"
              fontSize={9.5}
              fill={MUTED}
              fontFamily={MONO}
            >
              {t}
            </text>
          </g>
        ))}
        <Tag x={RIGHT} y={AXIS_Y + 34} anchor="end" tone="muted">
          Degrees F
        </Tag>

        {/* What the angler has. */}
        {observed ? (
          <g>
            {observed[0] !== observed[1] ? (
              <rect
                x={x(observed[0])}
                y={AXIS_Y - BAR_H - 20}
                width={Math.max(2, x(observed[1]) - x(observed[0]))}
                height={BAR_H + 20}
                fill={BRASS}
                opacity={0.16}
              />
            ) : null}
            {observed.map((v, i) =>
              i === 1 && observed[0] === observed[1] ? null : (
                <g key={i}>
                  <line
                    x1={x(v)}
                    y1={AXIS_Y - BAR_H - 22}
                    x2={x(v)}
                    y2={AXIS_Y}
                    stroke={BRASS}
                    strokeWidth={2.2}
                  />
                  <circle
                    cx={x(v)}
                    cy={AXIS_Y - BAR_H - 22}
                    r={5}
                    fill={BRASS}
                    stroke={PAPER}
                    strokeWidth={1.3}
                  />
                </g>
              ),
            )}
            <text
              x={x((observed[0] + observed[1]) / 2)}
              y={AXIS_Y - BAR_H - 32}
              textAnchor="middle"
              fontSize={10}
              fill={BRASS}
              fontFamily={MONO}
              letterSpacing="0.12em"
            >
              {(spec.observedLabel ?? "YOURS").toUpperCase()}
            </text>
          </g>
        ) : null}
      </Canvas>
    </Plate>
  );
}
