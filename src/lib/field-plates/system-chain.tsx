/**
 * Hook the Horizon — system chain plate.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk.
 *
 * A fishing system is a chain, and a chain has exactly one interesting
 * property: where it gives out. Reading that off a table of components is
 * work. Seeing it is not.
 *
 * The plate refuses to rank gear. Every link is judged against one declared
 * job, and a link that is wrong for this job may be perfect for the next one
 * — which is why the caption says the job out loud and the fix is usually
 * "move it" rather than "replace it".
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
  MUTED,
  PANEL,
  PAPER,
  Plate,
  STEADY,
  Tag,
  toneColor,
  type Tone,
} from "./kit";

export type LinkVerdict = "fits" | "tight" | "mismatch" | "unknown";

export type ChainLink = {
  id: string;
  /** What the component does in the chain: "Main line", "Leader knot", "Hook". */
  role: string;
  /** What it actually is, in the reader's own words. */
  spec?: string | undefined;
  /**
   * How much margin this link has for the declared job, 0 to 1.
   * `null` means the app does not know, which is drawn as not known.
   */
  headroom: number | null;
  verdict: LinkVerdict;
  /** One sentence. What gives, and under what. */
  note?: string | undefined;
};

export type SystemChainSpec = {
  /** The job the whole chain is being judged against. Never omit it. */
  job: string;
  links: ChainLink[];
  /** Which link gives out first. Null when nothing does. */
  weakest?: string | null | undefined;
  /** The cheapest sensible correction, when one exists. */
  fix?: { linkId?: string | undefined; what: string } | null | undefined;
};

const VERDICT_TONE: Record<LinkVerdict, Tone> = {
  fits: "steady",
  tight: "watch",
  mismatch: "alarm",
  unknown: "muted",
};

const VERDICT_WORD: Record<LinkVerdict, string> = {
  fits: "Fits the job",
  tight: "Tight",
  mismatch: "Wrong for this job",
  unknown: "Not known",
};

const H = 196;
const BOX_W = 118;
const BOX_H = 74;
const GAP = 26;
const TOP = 54;

export function SystemChainPlate({
  spec,
  eyebrow = "Whole system",
  title,
  caption,
  aside,
  unknown,
  testid = "system-chain-plate",
}: {
  spec: SystemChainSpec;
  eyebrow?: string | undefined;
  title: string;
  caption?: string | undefined;
  aside?: ReactNode | undefined;
  unknown?: ReactNode | undefined;
  testid?: string | undefined;
}) {
  const links = spec.links;
  const W = Math.max(560, links.length * (BOX_W + GAP) + GAP + 24);
  const weakIndex = links.findIndex((l) => l.id === spec.weakest);

  return (
    <Plate
      eyebrow={eyebrow}
      title={title}
      caption={caption ?? `Judged against one job: ${spec.job}.`}
      testid={testid}
      aside={aside}
      unknown={unknown}
      legend={
        <>
          {links.map((l, i) => (
            <LegendRow
              key={l.id}
              n={i + 1}
              label={`${l.role}${l.spec ? ` — ${l.spec}` : ""}`}
              tone={VERDICT_TONE[l.verdict]}
            >
              {VERDICT_WORD[l.verdict]}
              {l.note ? `. ${l.note}` : "."}
            </LegendRow>
          ))}
          {spec.fix ? (
            <LegendRow label="Cheapest correction" tone="accent">
              {spec.fix.what}
            </LegendRow>
          ) : null}
        </>
      }
    >
      <Canvas
        w={W}
        h={H}
        min={Math.min(W, 620)}
        label={`Component chain for ${spec.job}, load running left to right`}
      >
        <Tag x={14} y={22} tone="accent">
          Load runs this way
        </Tag>
        <Arrow from={[14, 34]} to={[W - 20, 34]} tone="muted" width={1.1} />

        {links.map((l, i) => {
          const x = 14 + i * (BOX_W + GAP);
          const tone = VERDICT_TONE[l.verdict];
          const c = toneColor(tone);
          const weak = i === weakIndex;
          return (
            <g key={l.id}>
              {/* Connector to the next link — this is where most chains fail. */}
              {i < links.length - 1 ? (
                <line
                  x1={x + BOX_W}
                  y1={TOP + BOX_H / 2}
                  x2={x + BOX_W + GAP}
                  y2={TOP + BOX_H / 2}
                  stroke={MUTED}
                  strokeWidth={2.2}
                />
              ) : null}

              <rect
                x={x}
                y={TOP}
                width={BOX_W}
                height={BOX_H}
                fill={weak ? ALARM : PAPER}
                fillOpacity={weak ? 0.08 : 1}
                stroke={c}
                strokeWidth={weak ? 2.4 : 1.4}
              />

              <text
                x={x + 10}
                y={TOP + 20}
                fontSize={9.5}
                fill={c}
                fontFamily={MONO}
                letterSpacing="0.12em"
              >
                {String(i + 1).padStart(2, "0")} {l.role.toUpperCase()}
              </text>
              {l.spec ? (
                <text x={x + 10} y={TOP + 38} fontSize={11} fill={INK} fontFamily={MONO}>
                  {l.spec.length > 15 ? `${l.spec.slice(0, 14)}…` : l.spec}
                </text>
              ) : null}

              {/* Headroom bar: how much margin is left before this link is the problem. */}
              <rect x={x + 10} y={TOP + BOX_H - 18} width={BOX_W - 20} height={7} fill={PANEL} />
              {l.headroom === null ? (
                <text
                  x={x + 10}
                  y={TOP + BOX_H - 5}
                  fontSize={8.5}
                  fill={MUTED}
                  fontFamily={MONO}
                  letterSpacing="0.1em"
                >
                  NOT KNOWN
                </text>
              ) : (
                <rect
                  x={x + 10}
                  y={TOP + BOX_H - 18}
                  width={Math.max(2, (BOX_W - 20) * Math.max(0, Math.min(1, l.headroom)))}
                  height={7}
                  fill={c}
                />
              )}

              {weak ? (
                <>
                  <FailureMark x={x + BOX_W - 6} y={TOP - 6} scale={0.95} />
                  <text
                    x={x + BOX_W / 2}
                    y={TOP + BOX_H + 24}
                    textAnchor="middle"
                    fontSize={10}
                    fill={ALARM}
                    fontFamily={MONO}
                    letterSpacing="0.13em"
                  >
                    GIVES FIRST
                  </text>
                </>
              ) : null}
            </g>
          );
        })}

        {weakIndex < 0 ? (
          <text
            x={14}
            y={H - 14}
            fontSize={10.5}
            fill={STEADY}
            fontFamily={MONO}
            letterSpacing="0.12em"
          >
            NO SINGLE WEAK LINK FOUND FOR THIS JOB
          </text>
        ) : null}

        {spec.fix ? (
          <text
            x={14}
            y={H - 14}
            fontSize={10.5}
            fill={BRASS}
            fontFamily={MONO}
            letterSpacing="0.12em"
          >
            {`FIX: ${spec.fix.what}`.slice(0, 82).toUpperCase()}
          </text>
        ) : null}
      </Canvas>
    </Plate>
  );
}

/**
 * The weakest link, by the plainest rule that survives an argument: the least
 * headroom wins, and a declared mismatch beats a low number.
 *
 * Returns null when nothing in the chain is known well enough to name — which
 * is a real answer and better than picking the only component that happens to
 * carry a number.
 */
export function weakestLink(links: readonly ChainLink[]): ChainLink | null {
  const mismatched = links.filter((l) => l.verdict === "mismatch");
  const pool = mismatched.length ? mismatched : links.filter((l) => l.headroom !== null);
  if (!pool.length) return null;
  return pool.reduce((worst, l) => ((l.headroom ?? 1) < (worst.headroom ?? 1) ? l : worst));
}
