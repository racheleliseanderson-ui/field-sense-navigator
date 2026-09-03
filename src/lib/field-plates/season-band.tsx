/**
 * Hook the Horizon — season band plate.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk.
 *
 * A calendar is the wrong instrument for this and everybody uses one anyway.
 * Fish move on water temperature and day length, not on the first of the
 * month, so the band draws the phases against the months while keeping the
 * temperature that actually drives them visible underneath. A warm spring
 * slides the whole thing left and the plate should make that obvious rather
 * than hide it behind a month name.
 */

import type { ReactNode } from "react";

import {
  BRASS,
  Canvas,
  INK,
  LegendRow,
  MONO,
  MUTED,
  PANEL,
  PAPER,
  Plate,
  Tag,
  toneColor,
  type Tone,
} from "./kit";

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type SeasonPhase = {
  id: string;
  label: string;
  /** Month index 0-11. A phase may wrap the year end. */
  from: number;
  to: number;
  tone?: Tone | undefined;
  /** What the fish is doing, and where that puts it. */
  note?: string | undefined;
  /** The water temperature band this phase actually tracks, in Fahrenheit. */
  tempF?: [number, number] | null | undefined;
};

export type SeasonBandSpec = {
  phases: SeasonPhase[];
  /** 0-11. Marked, not emphasised — today is a fact, not an argument. */
  currentMonth?: number | null | undefined;
  /** Observed or typical water temperature by month, if the app has it. */
  tempTrack?: { month: number; f: number }[] | null | undefined;
  /** Why the months are approximate here. Always worth saying. */
  caveat?: string | undefined;
};

const W = 720;
const H = 250;
const LEFT = 46;
const RIGHT = W - 22;
const BAND_TOP = 56;
const BAND_H = 34;
const TRACK_TOP = 118;
const TRACK_H = 82;

const colX = (m: number) => LEFT + (m / 12) * (RIGHT - LEFT);

export function SeasonBandPlate({
  spec,
  eyebrow = "Through the year",
  title,
  caption,
  aside,
  testid = "season-band-plate",
}: {
  spec: SeasonBandSpec;
  eyebrow?: string | undefined;
  title: string;
  caption?: string | undefined;
  aside?: ReactNode | undefined;
  testid?: string | undefined;
}) {
  const track = spec.tempTrack ?? [];
  const temps = track.map((t) => t.f);
  const lo = temps.length ? Math.min(...temps) - 4 : 32;
  const hi = temps.length ? Math.max(...temps) + 4 : 80;
  const tempY = (f: number) => TRACK_TOP + TRACK_H - ((f - lo) / Math.max(1, hi - lo)) * TRACK_H;

  /** A wrapping phase draws as two segments so the year end is not a lie. */
  const segments = spec.phases.flatMap((p, row) =>
    p.from <= p.to
      ? [{ p, row, from: p.from, to: p.to + 1 }]
      : [
          { p, row, from: p.from, to: 12 },
          { p, row, from: 0, to: p.to + 1 },
        ],
  );

  const rows = spec.phases.length;
  const rowH = rows > 0 ? Math.min(BAND_H, 110 / rows) : BAND_H;

  return (
    <Plate
      eyebrow={eyebrow}
      title={title}
      caption={caption}
      testid={testid}
      aside={aside}
      unknown={spec.caveat ? <>{spec.caveat}</> : undefined}
      legend={
        <>
          {spec.phases.map((p, i) => (
            <LegendRow key={p.id} n={i + 1} label={p.label} tone={p.tone ?? "accent"}>
              {p.note ?? ""}
              {p.tempF ? ` Tracks roughly ${p.tempF[0]}–${p.tempF[1]}°F.` : ""}
            </LegendRow>
          ))}
        </>
      }
    >
      <Canvas w={W} h={Math.max(H, 120 + rows * (rowH + 6))} min={520} label={`${title} through the year`}>
        {/* Month grid. */}
        {MONTH_SHORT.map((m, i) => (
          <g key={m}>
            <line x1={colX(i)} y1={BAND_TOP - 16} x2={colX(i)} y2={TRACK_TOP + TRACK_H} stroke={PANEL} strokeWidth={0.7} />
            <text
              x={colX(i) + (RIGHT - LEFT) / 24}
              y={BAND_TOP - 22}
              textAnchor="middle"
              fontSize={9.5}
              fill={i === spec.currentMonth ? BRASS : MUTED}
              fontFamily={MONO}
              letterSpacing="0.1em"
            >
              {m.toUpperCase()}
            </text>
          </g>
        ))}
        <line x1={colX(12)} y1={BAND_TOP - 16} x2={colX(12)} y2={TRACK_TOP + TRACK_H} stroke={PANEL} strokeWidth={0.7} />

        {/* Phase bars. */}
        {segments.map((s, i) => {
          const c = toneColor(s.p.tone ?? "accent");
          const y = BAND_TOP + s.row * (rowH + 6);
          return (
            <g key={`${s.p.id}-${i}`}>
              <rect
                x={colX(s.from)}
                y={y}
                width={colX(s.to) - colX(s.from)}
                height={rowH}
                fill={c}
                fillOpacity={0.24}
                stroke={c}
                strokeWidth={1.4}
              />
              <circle cx={colX(s.from) + 14} cy={y + rowH / 2} r={9} fill={c} />
              <text
                x={colX(s.from) + 14}
                y={y + rowH / 2 + 4}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill={PAPER}
                fontFamily={MONO}
              >
                {spec.phases.indexOf(s.p) + 1}
              </text>
              <text
                x={colX(s.from) + 30}
                y={y + rowH / 2 + 4}
                fontSize={10.5}
                fill={INK}
                fontFamily={MONO}
                letterSpacing="0.09em"
              >
                {s.p.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Temperature track — the thing the phases are actually following. */}
        {track.length > 1 ? (
          <g>
            <rect x={LEFT} y={TRACK_TOP} width={RIGHT - LEFT} height={TRACK_H} fill="none" stroke={PANEL} strokeWidth={1} />
            <path
              d={track
                .slice()
                .sort((a, b) => a.month - b.month)
                .map((t, i) => `${i === 0 ? "M" : "L"}${colX(t.month) + (RIGHT - LEFT) / 24},${tempY(t.f)}`)
                .join(" ")}
              fill="none"
              stroke={BRASS}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Tag x={LEFT + 6} y={TRACK_TOP + 14} tone="accent">
              Water temp
            </Tag>
            <text x={LEFT - 6} y={TRACK_TOP + 10} textAnchor="end" fontSize={9} fill={MUTED} fontFamily={MONO}>
              {Math.round(hi)}
            </text>
            <text x={LEFT - 6} y={TRACK_TOP + TRACK_H} textAnchor="end" fontSize={9} fill={MUTED} fontFamily={MONO}>
              {Math.round(lo)}
            </text>
          </g>
        ) : (
          <text x={LEFT} y={TRACK_TOP + 20} fontSize={10} fill={MUTED} fontFamily={MONO} letterSpacing="0.11em">
            NO TEMPERATURE TRACK FOR THIS WATER — THE MONTHS ARE THE ROUGHER GUIDE
          </text>
        )}

        {/* Today. */}
        {typeof spec.currentMonth === "number" ? (
          <g>
            <line
              x1={colX(spec.currentMonth) + (RIGHT - LEFT) / 24}
              y1={BAND_TOP - 16}
              x2={colX(spec.currentMonth) + (RIGHT - LEFT) / 24}
              y2={TRACK_TOP + TRACK_H}
              stroke={BRASS}
              strokeWidth={1.8}
              strokeDasharray="6 4"
            />
            <Tag x={colX(spec.currentMonth) + (RIGHT - LEFT) / 24} y={BAND_TOP - 34} anchor="middle" tone="accent">
              Now
            </Tag>
          </g>
        ) : null}
      </Canvas>
    </Plate>
  );
}
