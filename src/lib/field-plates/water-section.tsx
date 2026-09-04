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
  "flowing" | "stillwater" | "surf" | "inshore" | "nearshore" | "offshore";

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
/** Width of the drawn bank wedge at each edge, in viewBox units. */
const BANK = 54;
/** Water runs between these, so a zone at x=0 sits at the near waterline. */
const WATER_X0 = BANK;
const WATER_X1 = W - BANK;
const WATER_W = WATER_X1 - WATER_X0;

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
  const L = WATER_X0;
  const R = WATER_X1;
  const w = WATER_W;
  switch (kind) {
    /* A run: a shallow inside shelf, then a slot under the far bank. */
    case "flowing":
      return `M${L},${BED} L${L},${AIR + 34} C${L + w * 0.2},${AIR + 62} ${L + w * 0.34},${BED - 74} ${L + w * 0.56},${BED - 26} C${L + w * 0.7},${BED - 4} ${L + w * 0.86},${BED - 12} ${R},${AIR + 96} L${R},${BED} Z`;
    /* A shoreline: a flat, one break, then a basin that stops getting deeper. */
    case "stillwater":
      return `M${L},${BED} L${L},${AIR + 26} C${L + w * 0.16},${AIR + 42} ${L + w * 0.26},${AIR + 52} ${L + w * 0.34},${AIR + 74} C${L + w * 0.42},${AIR + 104} ${L + w * 0.5},${BED - 22} ${L + w * 0.66},${BED - 14} L${R},${BED - 12} L${R},${BED} Z`;
    /* A beach: inner trough, an outer bar, then the drop past it. */
    case "surf":
      return `M${L},${BED} L${L},${AIR + 8} C${L + w * 0.12},${AIR + 40} ${L + w * 0.2},${AIR + 96} ${L + w * 0.3},${AIR + 92} C${L + w * 0.4},${AIR + 88} ${L + w * 0.44},${AIR + 52} ${L + w * 0.54},${AIR + 56} C${L + w * 0.66},${AIR + 60} ${L + w * 0.74},${BED - 26} ${L + w * 0.88},${BED - 20} L${R},${BED - 18} L${R},${BED} Z`;
    /* Flats with a channel cut through them. */
    case "inshore":
      return `M${L},${BED} L${L},${AIR + 22} C${L + w * 0.18},${AIR + 30} ${L + w * 0.3},${AIR + 34} ${L + w * 0.38},${AIR + 36} C${L + w * 0.44},${AIR + 38} ${L + w * 0.46},${BED - 18} ${L + w * 0.56},${BED - 14} C${L + w * 0.68},${BED - 10} ${L + w * 0.72},${AIR + 44} ${L + w * 0.84},${AIR + 42} L${R},${AIR + 40} L${R},${BED} Z`;
    case "nearshore":
    case "offshore":
    default:
      return `M${L},${BED} L${L},${AIR + 70} C${L + w * 0.24},${AIR + 108} ${L + w * 0.44},${BED - 30} ${L + w * 0.66},${BED - 24} L${R},${BED - 22} L${R},${BED} Z`;
  }
}

/** The land the reader is standing on, and the far edge. */
function bankWedge(side: "near" | "far"): string {
  return side === "near"
    ? `M0,${AIR - 26} L${BANK},${AIR + 6} L${BANK},${H} L0,${H} Z`
    : `M${W},${AIR - 26} L${W - BANK},${AIR + 6} L${W - BANK},${H} L${W},${H} Z`;
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

const toX = (f: number) => WATER_X0 + Math.max(0, Math.min(1, f)) * WATER_W;
const toY = (f: number) => AIR + Math.max(0, Math.min(1, f)) * (BED - AIR);
const toW = (f: number) => Math.max(0, Math.min(1, f)) * WATER_W;
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
      inputs={[
        { label: "Water", value: spec.kind, source: "stated" },
        {
          label: "Current",
          value:
            spec.current === undefined
              ? "not stated"
              : (["slow", "moderate", "pushy"][spec.current - 1] ?? String(spec.current)),
          source: spec.current === undefined ? "assumed" : "stated",
        },
        {
          label: "Clarity",
          value: spec.clarity ?? "unknown",
          source: spec.clarity && spec.clarity !== "unknown" ? "stated" : "assumed",
        },
        {
          label: "Thermal break",
          value:
            typeof spec.thermocline === "number"
              ? `${Math.round(spec.thermocline * 100)}% down the column`
              : "none drawn",
          source: typeof spec.thermocline === "number" ? "stated" : "assumed",
        },
        { label: "Zones drawn", value: String(zones.length) },
        {
          label: "Zones still to be checked",
          value: String(zones.filter((z) => z.confidence === "check").length),
        },
      ]}
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
        <WaterField x={WATER_X0} y={AIR} w={WATER_W} h={BED - AIR} />
        {wash > 0 ? (
          <rect
            x={WATER_X0}
            y={AIR}
            width={WATER_W}
            height={BED - AIR}
            fill={LAND}
            opacity={wash}
          />
        ) : null}

        {/* Surface line. */}
        <line
          x1={WATER_X0}
          y1={AIR}
          x2={WATER_X1}
          y2={AIR}
          stroke={INK}
          strokeWidth={2}
          opacity={0.55}
        />

        {/* Thermal break, when one is known. A line the fish can feel. */}
        {typeof spec.thermocline === "number" ? (
          <g>
            <line
              x1={WATER_X0}
              y1={toY(spec.thermocline)}
              x2={WATER_X1}
              y2={toY(spec.thermocline)}
              stroke={BRASS}
              strokeWidth={1.4}
              strokeDasharray="10 7"
              opacity={0.85}
            />
            <Tag x={WATER_X1 - 6} y={toY(spec.thermocline) - 7} anchor="end" tone="accent">
              Thermal break
            </Tag>
          </g>
        ) : null}

        {/* Current, or the absence of it. */}
        {!still && spec.current ? (
          <Flow
            x={WATER_X0 + 8}
            y={AIR + 22}
            w={WATER_W - 16}
            rows={4}
            gap={30}
            speed={spec.current}
            opacity={0.42}
          />
        ) : null}
        {!still && spec.current === 3 ? (
          <Riffle x={WATER_X0} y={AIR - 6} w={WATER_W} h={12} density={40} />
        ) : null}
        {still ? (
          <Flow
            x={WATER_X0 + 8}
            y={AIR + 14}
            w={WATER_W - 16}
            rows={1}
            gap={0}
            speed={1}
            opacity={0.28}
          />
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
          const w = toW(z.at.w);
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

        {/* The ground goes on last, so anything drawn into it is cut off by it
            rather than floating through the bank. */}
        <path d={bedPath(spec.kind)} fill={`url(#${hatch})`} stroke={MUTED} strokeWidth={1.2} />
        <path d={bankWedge("near")} fill={`url(#${hatch})`} stroke={MUTED} strokeWidth={1.2} />
        <path d={bankWedge("far")} fill={`url(#${hatch})`} stroke={MUTED} strokeWidth={1.2} />

        {/* Edge labels and the stance. */}
        <Tag x={6} y={H - 12} tone="muted">
          {nearLabel}
        </Tag>
        <Tag x={W - 6} y={H - 12} anchor="end" tone="muted">
          {farLabel}
        </Tag>
        {/* The stance sits on the near bank, above the waterline, clear of both
            edge labels — it used to print straight through the near-bank tag. */}
        {typeof spec.stand === "number" ? (
          <Stand x={Math.min(toX(spec.stand), WATER_X0 + 46)} y={AIR - 34} label="You" />
        ) : null}
      </Canvas>
    </Plate>
  );
}

/** Air band paint. Transparent so the plate takes the card's own background. */
const PAPER_OR_NONE = "transparent";
