/**
 * Hook the Horizon — water section plate.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk.
 *
 * A cross-section of the water, cut from the near bank out. It exists because
 * "fish the seam" is a sentence that only works for somebody who can already
 * see the seam. The drawing is the part of the explanation that a paragraph
 * cannot do faster.
 *
 * The spec is deliberately plain data — no app types — so Waterways, Species,
 * Hatch and Field Ops can all hand it what they know and get the same picture
 * back. What each app knows differs; the geometry of a run does not.
 */

import type { ReactNode } from "react";

import {
  BankHatch,
  BRASS,
  Canvas,
  Flow,
  HoldingZone,
  INK,
  LAND,
  LegendRow,
  MUTED,
  Plate,
  Riffle,
  Stand,
  Structure,
  Tag,
  usePlateId,
  WaterField,
  type Tone,
} from "./kit";

export type WaterSectionKind =
  | "flowing"
  | "stillwater"
  | "surf"
  | "inshore"
  | "nearshore"
  | "offshore";

/** How sure the app is that a zone is really there. Drawn, not just claimed. */
export type ZoneConfidence = "observed" | "likely" | "check";

export type SectionZone = {
  id: string;
  /** Legend heading. Short — the reasoning goes in `why`. */
  label: string;
  /** What makes this water worth a cast, in one sentence. */
  why: string;
  /** Position as fractions of the water body: 0 = near bank / surface. */
  at: { x: number; y: number; w: number; h: number };
  confidence?: ZoneConfidence | undefined;
};

export type SectionStructure = {
  kind: "wood" | "rock" | "weed";
  /** Fractions of the water body. */
  at: { x: number; y: number };
  scale?: number | undefined;
};

export type WaterSectionSpec = {
  kind: WaterSectionKind;
  /** Names the two ends of the cut, e.g. ["Near bank", "Far bank"]. */
  edges?: [string, string] | undefined;
  /** 1 slow, 2 moderate, 3 pushy. Ignored on stillwater. */
  current?: 1 | 2 | 3 | undefined;
  /** Depth of a thermal break as a fraction of the column, or null if unknown. */
  thermocline?: number | null | undefined;
  clarity?: "clear" | "stained" | "murky" | "unknown" | undefined;
  structures?: SectionStructure[] | undefined;
  zones?: SectionZone[] | undefined;
  /** Where the reader would put their feet, as a fraction across. */
  stand?: number | null | undefined;
};

const W = 720;
const H = 300;
const AIR = 44;
const BED = 262;

const CONF_TONE: Record<ZoneConfidence, Tone> = {
  observed: "accent",
  likely: "watch",
  check: "muted",
};

const CONF_WORD: Record<ZoneConfidence, string> = {
  observed: "Seen",
  likely: "Likely",
  check: "Worth checking",
};

/**
 * Bed profile per water type.
 *
 * These are the shapes that change how you fish, not decoration: a river bed
 * that drops through a run and shallows onto a tailout, a lake shelf that
 * breaks once and then flattens, a beach with a trough behind the outer bar.
 */
function bedPath(kind: WaterSectionKind): string {
  switch (kind) {
    case "flowing":
      return `M0,${BED} L0,${BED - 26} C140,${BED - 34} 190,${BED - 86} 300,${BED - 92} C420,${BED - 98} 500,${BED - 52} 620,${BED - 30} L${W},${BED - 22} L${W},${H} L0,${H} Z`;
    case "stillwater":
      return `M0,${BED} L0,${BED - 8} C90,${BED - 16} 150,${BED - 40} 210,${BED - 96} C250,${BED - 132} 320,${BED - 150} 430,${BED - 154} L${W},${BED - 156} L${W},${H} L0,${H} Z`;
    case "surf":
      return `M0,${BED} L0,${BED - 4} C90,${BED - 22} 150,${BED - 74} 235,${BED - 78} C300,${BED - 81} 320,${BED - 52} 380,${BED - 50} C450,${BED - 48} 470,${BED - 96} 545,${BED - 100} C620,${BED - 104} 660,${BED - 86} ${W},${BED - 92} L${W},${H} L0,${H} Z`;
    case "inshore":
      return `M0,${BED} L0,${BED - 10} C120,${BED - 18} 210,${BED - 26} 285,${BED - 30} C330,${BED - 33} 350,${BED - 128} 420,${BED - 132} C500,${BED - 136} 540,${BED - 44} 640,${BED - 40} L${W},${BED - 38} L${W},${H} L0,${H} Z`;
    case "nearshore":
    case "offshore":
    default:
      return `M0,${BED} L0,${BED - 60} C160,${BED - 96} 260,${BED - 168} 400,${BED - 176} C520,${BED - 183} 600,${BED - 170} ${W},${BED - 174} L${W},${H} L0,${H} Z`;
  }
}

function clarityWash(clarity: WaterSectionSpec["clarity"]): number {
  switch (clarity) {
    case "clear":
      return 0;
    case "stained":
      return 0.16;
    case "murky":
      return 0.34;
    default:
      return 0;
  }
}

const toX = (f: number) => Math.max(0, Math.min(1, f)) * W;
const toY = (f: number) => AIR + Math.max(0, Math.min(1, f)) * (BED - AIR);
const toH = (f: number) => Math.max(0, Math.min(1, f)) * (BED - AIR);

type ReactChild = ReactNode;

export function WaterSectionPlate({
  spec,
  eyebrow = "Water section",
  title,
  caption,
  aside,
  unknown,
  testid = "water-section-plate",
}: {
  spec: WaterSectionSpec;
  eyebrow?: string | undefined;
  title: string;
  caption?: string | undefined;
  aside?: ReactChild | undefined;
  unknown?: ReactChild | undefined;
  testid?: string | undefined;
}) {
  const hatch = usePlateId("bank");
  const zones = spec.zones ?? [];
  const still = spec.kind === "stillwater";
  const [nearLabel, farLabel] = spec.edges ?? ["Near bank", "Far side"];
  const wash = clarityWash(spec.clarity);

  return (
    <Plate
      eyebrow={eyebrow}
      title={title}
      caption={caption}
      testid={testid}
      aside={aside}
      unknown={unknown}
      legend={
        zones.length ? (
          <>
            {zones.map((z, i) => (
              <LegendRow
                key={z.id}
                n={i + 1}
                label={z.label}
                tone={CONF_TONE[z.confidence ?? "likely"]}
              >
                {z.why}
                {z.confidence ? ` — ${CONF_WORD[z.confidence].toLowerCase()}.` : null}
              </LegendRow>
            ))}
          </>
        ) : undefined
      }
    >
      <Canvas w={W} h={H} min={520} label={`Cross-section of ${title}, near side on the left`}>
        <BankHatch id={hatch} />

        {/* Air above the surface, so the waterline is unambiguous. */}
        <rect x={0} y={0} width={W} height={AIR} fill={PAPER_OR_NONE} />

        {/* Water column. */}
        <WaterField x={0} y={AIR} w={W} h={BED - AIR} />
        {wash > 0 ? <rect x={0} y={AIR} width={W} height={BED - AIR} fill={LAND} opacity={wash} /> : null}

        {/* Surface line. */}
        <line x1={0} y1={AIR} x2={W} y2={AIR} stroke={INK} strokeWidth={2} opacity={0.55} />

        {/* Bed. */}
        <path d={bedPath(spec.kind)} fill={`url(#${hatch})`} stroke={MUTED} strokeWidth={1.2} />

        {/* Thermal break, when one is known. A line the fish can feel. */}
        {typeof spec.thermocline === "number" ? (
          <g>
            <line
              x1={0}
              y1={toY(spec.thermocline)}
              x2={W}
              y2={toY(spec.thermocline)}
              stroke={BRASS}
              strokeWidth={1.4}
              strokeDasharray="10 7"
              opacity={0.85}
            />
            <Tag x={W - 8} y={toY(spec.thermocline) - 7} anchor="end" tone="accent">
              Thermal break
            </Tag>
          </g>
        ) : null}

        {/* Current, or the absence of it. */}
        {!still && spec.current ? (
          <Flow x={10} y={AIR + 22} w={W - 20} rows={4} gap={30} speed={spec.current} opacity={0.42} />
        ) : null}
        {!still && spec.current === 3 ? <Riffle x={0} y={AIR - 6} w={W} h={12} density={40} /> : null}
        {still ? (
          <Flow x={10} y={AIR + 14} w={W - 20} rows={1} gap={0} speed={1} opacity={0.28} />
        ) : null}

        {/* Structure sits behind the zones: it is why the zone is there. */}
        {(spec.structures ?? []).map((s, i) => (
          <Structure
            key={`${s.kind}-${i}`}
            kind={s.kind}
            x={toX(s.at.x)}
            y={toY(s.at.y)}
            scale={s.scale ?? 1}
          />
        ))}

        {/* Holding zones. */}
        {zones.map((z, i) => {
          const x = toX(z.at.x);
          const y = toY(z.at.y);
          const w = toX(z.at.w);
          const h = toH(z.at.h);
          const r = Math.min(w, h) / 2.4;
          const d = `M${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} Z`;
          return (
            <HoldingZone
              key={z.id}
              d={d}
              n={i + 1}
              at={[x + w / 2, y + h / 2]}
              tone={CONF_TONE[z.confidence ?? "likely"]}
            />
          );
        })}

        {/* Edge labels and the stance. */}
        <Tag x={10} y={AIR - 14} tone="muted">
          {nearLabel}
        </Tag>
        <Tag x={W - 10} y={AIR - 14} anchor="end" tone="muted">
          {farLabel}
        </Tag>
        {typeof spec.stand === "number" ? <Stand x={toX(spec.stand)} y={AIR - 26} /> : null}
      </Canvas>
    </Plate>
  );
}

/** Air band paint. Transparent so the plate takes the card's own background. */
const PAPER_OR_NONE = "transparent";
