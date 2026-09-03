/**
 * Hook the Horizon — forage silhouette plate.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk.
 *
 * Identification from a photograph is a specialist skill. Identification from
 * a silhouette, a length and two or three structures you can actually see on
 * a wet rock is a skill somebody can learn in an afternoon, and it is the one
 * that survives a phone camera in the wind.
 *
 * So the plate draws the outline at a stated scale, marks the structures that
 * separate one group from another, and leaves the doubt attached: a specimen
 * the app is unsure about is drawn as unsure rather than smoothed into a
 * confident answer.
 */

import type { ReactNode } from "react";

import {
  Callout,
  Canvas,
  INK,
  LegendRow,
  MONO,
  MUTED,
  PANEL,
  Plate,
  Span,
  Tag,
  type Tone,
} from "./kit";

export type ForageForm =
  | "mayfly-dun"
  | "mayfly-nymph"
  | "caddis-adult"
  | "caddis-larva"
  | "stonefly-nymph"
  | "midge"
  | "terrestrial"
  | "baitfish"
  | "crayfish"
  | "shrimp"
  | "worm"
  | "leech"
  | "egg"
  | "unknown";

export type ForageConfidence = "matches" | "possible" | "no idea";

export type ForageCue = {
  /** Where on the silhouette to point, in fractions of its bounding box. */
  at: [number, number];
  /** What the reader is looking at, and why it separates this from something else. */
  text: string;
};

export type ForageSpecimen = {
  form: ForageForm;
  label: string;
  /** Body length excluding tails, in millimetres. Null when it was not measured. */
  lengthMm?: number | null;
  cues?: ForageCue[];
  confidence?: ForageConfidence;
  /** Why the app landed here, and what would change its mind. */
  because?: string;
  /** What observation would settle it. */
  wouldSettleIt?: string;
};

const W = 640;
const H = 300;
const BOX = { x: 70, y: 44, w: 380, h: 190 };

const CONF_TONE: Record<ForageConfidence, Tone> = {
  matches: "steady",
  possible: "watch",
  "no idea": "muted",
};

const CONF_WORD: Record<ForageConfidence, string> = {
  matches: "Matches the group",
  possible: "One of a few things it could be",
  "no idea": "Not identified — and that is the honest answer",
};

const FORM_LABEL: Record<ForageForm, string> = {
  "mayfly-dun": "Mayfly, winged",
  "mayfly-nymph": "Mayfly nymph",
  "caddis-adult": "Caddis, winged",
  "caddis-larva": "Caddis larva",
  "stonefly-nymph": "Stonefly nymph",
  midge: "Midge",
  terrestrial: "Terrestrial",
  baitfish: "Forage fish",
  crayfish: "Crayfish",
  shrimp: "Shrimp or scud",
  worm: "Aquatic worm",
  leech: "Leech",
  egg: "Egg",
  unknown: "Not placed",
};

/**
 * Outlines, drawn in a 0-100 box and scaled by the caller.
 *
 * They are silhouettes on purpose. Colour and pattern vary enormously inside
 * a group and shape does not, so a shape is the thing a beginner can trust.
 */
function outline(form: ForageForm): string {
  switch (form) {
    case "mayfly-dun":
      return "M18,62 C26,52 40,50 52,54 L64,56 C74,57 82,60 88,64 M52,54 C50,36 44,22 34,10 M56,55 C60,38 58,24 50,12 M18,62 C10,64 6,68 4,72 M22,63 C16,70 12,76 10,84 M26,64 C24,72 22,80 22,90";
    case "mayfly-nymph":
      return "M12,54 C22,44 40,42 56,46 C70,50 82,54 92,58 M56,46 C58,38 56,32 50,28 M20,50 C16,42 12,38 6,36 M26,52 C24,44 20,38 14,34 M92,58 C96,50 98,44 98,38 M92,58 C98,62 100,68 100,74 M92,58 C96,66 96,74 94,82";
    case "caddis-adult":
      return "M14,60 C24,44 46,36 70,40 C86,43 94,52 96,62 C86,70 60,74 36,70 C24,68 16,64 14,60 Z M20,56 C16,44 12,34 6,26 M24,55 C22,42 20,32 16,22";
    case "caddis-larva":
      return "M8,58 C18,48 34,44 52,46 L84,50 C92,51 96,56 96,62 C96,68 90,72 82,72 L48,70 C28,68 12,64 8,58 Z M52,46 L52,70 M64,47 L64,71 M76,48 L76,71";
    case "stonefly-nymph":
      return "M10,56 C22,44 44,40 62,44 C78,48 90,54 98,60 M62,44 C64,34 62,26 56,20 M20,52 C14,44 8,40 2,38 M24,54 C20,46 16,40 10,36 M98,60 C102,54 104,48 104,42 M98,60 C102,66 104,72 104,80 M40,48 L40,66 M56,50 L56,68 M72,53 L72,70";
    case "midge":
      return "M28,60 C36,54 50,52 64,54 C76,56 86,58 94,62 M64,54 C64,46 62,40 58,36 M40,57 C36,50 32,46 26,44 M44,57 C42,50 38,46 32,42";
    case "terrestrial":
      return "M20,60 C28,48 46,44 64,48 C80,51 90,56 96,62 C88,70 66,74 46,70 C30,67 22,64 20,60 Z M40,52 C36,42 30,36 22,32 M56,50 C54,40 50,34 42,30 M70,52 C72,42 76,36 84,32";
    case "baitfish":
      return "M10,60 C30,38 66,34 92,46 C106,52 112,58 116,62 C112,68 106,74 92,80 C66,92 30,86 10,62 Z M10,60 C2,52 0,46 0,40 M10,62 C2,72 0,80 0,86 M88,52 C92,58 92,66 88,72";
    case "crayfish":
      return "M22,60 C34,50 56,46 76,50 C92,53 100,58 104,62 C100,68 92,72 76,74 C56,77 34,72 22,62 Z M22,60 C12,50 6,44 2,36 M22,62 C12,72 6,80 2,88 M76,50 L84,42 M76,74 L84,82 M56,48 L56,40 M64,48 L64,40";
    case "shrimp":
      return "M20,44 C40,32 70,36 86,54 C96,66 92,80 76,84 C56,88 32,76 22,58 C18,52 18,48 20,44 Z M34,44 L36,58 M46,42 L48,58 M58,44 L60,60 M86,54 C92,50 96,46 98,40";
    case "worm":
      return "M8,58 C20,42 34,74 48,58 C62,42 76,74 90,58 C98,49 102,46 108,46";
    case "leech":
      return "M8,60 C22,44 40,44 56,54 C72,64 88,66 104,58 C98,70 82,76 62,72 C42,68 20,70 8,60 Z";
    case "egg":
      return "M56,58 m-26,0 a26,26 0 1,0 52,0 a26,26 0 1,0 -52,0";
    default:
      return "M20,60 C36,40 72,40 92,60 C72,82 36,82 20,60 Z";
  }
}

/** Closed shapes take a fill; the sparse leggy outlines do not. */
const FILLED: ReadonlySet<ForageForm> = new Set([
  "caddis-adult",
  "caddis-larva",
  "terrestrial",
  "baitfish",
  "crayfish",
  "shrimp",
  "leech",
  "egg",
  "unknown",
]);

export function ForageSilhouettePlate({
  specimen,
  eyebrow = "What you are looking at",
  title,
  caption,
  aside,
  testid = "forage-silhouette-plate",
}: {
  specimen: ForageSpecimen;
  eyebrow?: string;
  title?: string;
  caption?: string;
  aside?: ReactNode;
  testid?: string;
}) {
  const conf = specimen.confidence ?? "possible";
  const tone = CONF_TONE[conf];
  const cues = specimen.cues ?? [];
  const filled = FILLED.has(specimen.form);
  const uncertain = conf !== "matches";

  return (
    <Plate
      eyebrow={eyebrow}
      title={title ?? specimen.label}
      caption={caption}
      testid={testid}
      aside={aside}
      unknown={
        specimen.wouldSettleIt ? <>What would settle it: {specimen.wouldSettleIt}</> : undefined
      }
      legend={
        <>
          <LegendRow label={FORM_LABEL[specimen.form]} tone={tone}>
            {CONF_WORD[conf]}
            {specimen.because ? `. ${specimen.because}` : "."}
          </LegendRow>
          {cues.map((c, i) => (
            <LegendRow key={i} n={i + 1} label="Look here" tone="accent">
              {c.text}
            </LegendRow>
          ))}
          {specimen.lengthMm ? (
            <LegendRow label="Size" tone="ink">
              About {specimen.lengthMm} mm in the body, tails not counted. Size separates more groups than
              colour does.
            </LegendRow>
          ) : (
            <LegendRow label="Size" tone="muted">
              Not measured. Put it next to a hook or a fingernail next time — it narrows the list faster than
              anything else you can see.
            </LegendRow>
          )}
        </>
      }
    >
      <Canvas w={W} h={H} min={460} label={`Silhouette of ${specimen.label}`}>
        <g transform={`translate(${BOX.x},${BOX.y}) scale(${BOX.w / 120},${BOX.h / 100})`}>
          <path
            d={outline(specimen.form)}
            fill={filled ? INK : "none"}
            fillOpacity={filled ? (uncertain ? 0.5 : 0.82) : 0}
            stroke={INK}
            strokeWidth={uncertain ? 2.4 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={conf === "no idea" ? "7 6" : undefined}
            opacity={uncertain ? 0.85 : 1}
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {cues.map((c, i) => {
          const px = BOX.x + c.at[0] * BOX.w;
          const py = BOX.y + c.at[1] * BOX.h;
          const out: [number, number] = [
            px < BOX.x + BOX.w / 2 ? Math.max(24, px - 46) : Math.min(W - 24, px + 46),
            py < BOX.y + BOX.h / 2 ? Math.max(20, py - 30) : Math.min(H - 40, py + 30),
          ];
          return <Callout key={i} at={[px, py]} to={out} n={i + 1} />;
        })}

        {/* Scale bar. A silhouette with no scale is a cartoon. */}
        {specimen.lengthMm ? (
          <g>
            <Span
              from={BOX.x}
              to={BOX.x + BOX.w}
              y={BOX.y + BOX.h + 34}
              label={`${specimen.lengthMm} mm body`}
              tone="accent"
            />
            <text
              x={BOX.x + BOX.w / 2}
              y={BOX.y + BOX.h + 52}
              textAnchor="middle"
              fontSize={9.5}
              fill={MUTED}
              fontFamily={MONO}
              letterSpacing="0.11em"
            >
              DRAWN TO THE LENGTH YOU ENTERED
            </text>
          </g>
        ) : (
          <text
            x={BOX.x}
            y={BOX.y + BOX.h + 40}
            fontSize={9.5}
            fill={MUTED}
            fontFamily={MONO}
            letterSpacing="0.11em"
          >
            NO LENGTH GIVEN — THIS OUTLINE IS NOT TO SCALE
          </text>
        )}

        <Tag x={W - 16} y={30} anchor="end" tone={tone}>
          {CONF_WORD[conf]}
        </Tag>
        <rect
          x={BOX.x - 16}
          y={BOX.y - 16}
          width={BOX.w + 32}
          height={BOX.h + 32}
          fill="none"
          stroke={PANEL}
          strokeWidth={1}
          strokeDasharray={uncertain ? "6 6" : undefined}
        />
      </Canvas>
    </Plate>
  );
}

export { FORM_LABEL as FORAGE_FORM_LABEL };
