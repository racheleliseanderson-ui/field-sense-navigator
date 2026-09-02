import { displayName, type Destination, type WaterType } from "@/lib/catalog";
import { HORIZON } from "@/lib/fleet";
import { JOBS, readTags, readiness, type JobId } from "@/lib/intelligence";
import { readAccess } from "@/lib/access";
import { readWater, cuesFor, type ReadLevel } from "@/lib/water-reading";

/* ------------------------------------------------------------------ *
 * Hook the Horizon handoffs
 *
 * Water → Species → Forage/Hatch → Presentation → Tackle → Knot →
 * Field Ops. Rig Signal is an optional device-validation sidecar, not a
 * presentation engine. Field Sense answers the first question in the core
 * chain; these handoffs carry what it knows into the focused instrument that
 * answers the next question, so the reader never restates the water they
 * already chose.
 *
 * The packet travels in the URL fragment, which is never sent to a server.
 * Nothing is posted automatically — a handoff is a link the reader presses.
 * It carries no coordinates and no private water, by contract.
 * ------------------------------------------------------------------ */

export const FLEET_CONTRACT = "HTH-FLEET-1.0" as const;
export const PACKET_VERSION = "HTH-1.0" as const;
export const INSTRUMENT_ID = "HTH-HH-001" as const;

export type HandoffTarget = "species" | "hatch" | "rig" | "tackle" | "knot" | "ops";

const appUrl = (name: string, fallback: string): string => {
  const hit = HORIZON.apps.find((a) => a.name === name);
  return `${hit?.url ?? fallback}/`.replace(/\/+$/, "/");
};

/** Resolved from the fleet registry so a moved instrument is fixed in one place. */
export const TARGET_URL: Record<HandoffTarget, string> = {
  species: appUrl("Species & Presentation", "https://species.hookthehorizon.blog"),
  hatch: appUrl("Hatch Match", "https://hatch.hookthehorizon.blog"),
  rig: appUrl("Rig Signal", "https://rig-signal.hookthehorizon.blog"),
  tackle: appUrl("Tackle Link Analyst", "https://tackle.hookthehorizon.blog"),
  knot: appUrl("Knot Analyst", "https://knot.hookthehorizon.blog"),
  ops: appUrl("Field Ops Desk", "https://ops.hookthehorizon.blog"),
};

/** Kept for the existing Species integration. */
export const SPECIES_URL = TARGET_URL.species;

export interface HandoffStep {
  id: HandoffTarget;
  /** The instrument's name in the fleet. */
  app: string;
  /** The step's role in the workflow. */
  step: string;
  /** The question this instrument answers. */
  question: string;
  /** Why it is the next step for THIS water. */
  why: string;
  url: string;
}

const STEP_META: Record<HandoffTarget, { app: string; step: string; question: string }> = {
  species: {
    app: "Species & Presentation",
    step: "Species",
    question:
      "Which of these fish are actually worth planning around, and how do they behave here?",
  },
  hatch: {
    app: "Hatch Match",
    step: "Forage & hatch",
    question: "What are they likely eating on this kind of water at this time of year?",
  },
  rig: {
    app: "Rig Signal",
    step: "Optional · device validation",
    question: "Do the electronics or device claims hold under the conditions you actually stated?",
  },
  tackle: {
    app: "Tackle Link Analyst",
    step: "Tackle",
    question: "Does my line, leader and terminal tackle survive this water?",
  },
  knot: {
    app: "Knot Analyst",
    step: "Knot",
    question: "Which connection holds for this line class and this structure?",
  },
  ops: {
    app: "Field Ops Desk",
    step: "Field ops",
    question: "How does this become a trip — travel, timing, kit and the checks still open?",
  },
};

/** Field Sense maps its four water classes onto the fleet's two flow classes. */
export function mapWaterType(waterType: WaterType): "flowing" | "stillwater" | undefined {
  if (waterType === "river") return "flowing";
  if (waterType === "lake" || waterType === "reservoir") return "stillwater";
  return undefined;
}

export interface HandoffContext {
  job?: JobId | null;
  /** A single species the reader has picked out of the record's context list. */
  species?: string | null;
  level?: ReadLevel;
}

/** Public-safe Field Sense → fleet packet. Named water only; no coordinates. */
export function buildPacket(d: Destination, target: HandoffTarget, ctx: HandoffContext = {}) {
  const waterType = mapWaterType(d.waterType);
  const createdAt = new Date().toISOString();
  const read = readWater(d);
  const r = readiness(d);
  const access = readAccess(d);
  const job = ctx.job ? JOBS.find((j) => j.id === ctx.job) : undefined;

  return {
    packetVersion: PACKET_VERSION,
    origin: "field-sense",
    intent: target,
    createdAt,
    instrumentId: INSTRUMENT_ID,
    fleet: {
      contract: FLEET_CONTRACT,
      trail: [{ origin: "field-sense", at: createdAt }],
      lastUpdatedBy: "field-sense",
    },
    water: {
      waterId: d.id,
      waterName: displayName(d),
      waterType,
      waterClass: d.waterType,
      region: d.region,
      state: d.state,
      jurisdiction: [d.county, d.state].filter(Boolean).join(", "),
      documentedSpecies: d.speciesContext,
      selectedSpecies: ctx.species ?? null,
      accessContext: d.status,
      managingAgency: d.managingAgency ?? null,
      officialSourceUrl: d.officialSourceUrl,
    },
    reading: {
      waterClass: read.waterClass,
      headline: read.headline,
      cues: cuesFor(read, ctx.level ?? "working").map((c) => ({
        family: c.family,
        title: c.title,
      })),
      shaped: read.shaped,
    },
    logistics: {
      namedSites: access.namedSites,
      directoryOnly: access.directoryOnly,
      trailerLaunch: access.counts.trailer_launch > 0,
      handLaunch: access.counts.hand_launch > 0,
      shoreAccess: access.counts.shore > 0 || access.counts.pier > 0,
      amenitiesPublished: access.logistics.map((l) => l.id),
    },
    job: job ? { id: job.id, label: job.label } : null,
    readiness: { score: r.score, band: r.band },
    openChecks: d.directVerification,
    conditions: {
      waterType,
      tempF: null,
      tempSource: "unknown",
    },
    provenance: [
      {
        source: "Field Sense named-public-water record",
        evidenceClass: "declared",
        reviewedAt: createdAt.slice(0, 10),
      },
    ],
    privacy: {
      containsCoordinates: false,
      containsPrivateWater: false,
    },
  };
}

/** A pressable link into another Hook instrument, context attached. */
export function handoffUrl(
  d: Destination,
  target: HandoffTarget,
  ctx: HandoffContext = {},
): string {
  const packet = buildPacket(d, target, ctx);
  return `${TARGET_URL[target]}#packet=${encodeURIComponent(JSON.stringify(packet))}`;
}

/** Why this instrument is the next honest step for this particular water. */
function whyFor(d: Destination, target: HandoffTarget, ctx: HandoffContext): string {
  const t = readTags(d);
  const access = readAccess(d);
  const species = ctx.species ?? d.speciesContext[0] ?? null;
  const count = d.speciesContext.length;

  switch (target) {
    case "species":
      return count
        ? `${count} species ${count === 1 ? "is" : "are"} documented on this record. Carry them across instead of retyping them.`
        : "No species is published on this record — start from the water class and let Species narrow it.";
    case "hatch":
      return d.waterType === "river"
        ? "Moving water, so drift is the whole forage question. The water class and season go across with the record."
        : d.waterType === "marine"
          ? "Tidal water — forage moves with the stage, not the calendar. The class and documented species go across."
          : "Still water, so forage is tied to habitat rather than drift. The class and documented species go across.";
    case "rig":
      return t.hazards.has("current")
        ? "Current is documented here. If you are relying on electronics or a device claim, carry the water context over and test whether that claim survives moving water."
        : t.hazards.has("level")
          ? "Level swing is documented here. Use Rig Signal only if a depth, mapping, sonar or device claim matters to the trip."
          : "Rig Signal is optional here: use it only when the trip depends on a device or electronics claim that should be checked against the stated conditions.";
    case "tackle":
      return t.hazards.has("traffic") || t.hazards.has("current")
        ? "Heavy current or traffic is on record; line and terminal choices have to survive it."
        : species
          ? `Line and terminal tackle sized to ${species.toLowerCase()} and to this water's cover.`
          : "Line and terminal tackle sized to this water's cover and species context.";
    case "knot":
      return "The connection is the part that fails. Line class and the structure you are fishing decide it.";
    case "ops":
      return d.directVerification.length
        ? `${d.directVerification.length} same-day check${d.directVerification.length === 1 ? "" : "s"} still open, plus ${access.namedSites} named access site${access.namedSites === 1 ? "" : "s"}. Turn it into a trip.`
        : "Turn the record into a trip: travel, timing, kit and the checks you still owe.";
    default:
      return "";
  }
}

/** The workflow, in order, for one water. Rig Signal is optional even though it remains visible. */
export const HANDOFF_ORDER: HandoffTarget[] = ["species", "hatch", "rig", "tackle", "knot", "ops"];

/**
 * The whole workflow as a list, for pages that have no single water in hand
 * (the home page, the footer). Field Sense is the stop marked `here`.
 */
export interface WorkflowStop {
  id: HandoffTarget | "water";
  app: string;
  step: string;
  question: string;
  url: string;
  here: boolean;
}

export const WORKFLOW: WorkflowStop[] = [
  {
    id: "water",
    app: "Field Sense Navigator",
    step: "Water",
    question: "Which water, what kind of water is it, and what still has to be checked today?",
    url:
      HORIZON.apps.find((a) => a.name === "Field Sense Navigator")?.url ??
      "https://waterways.hookthehorizon.blog",
    here: true,
  },
  ...HANDOFF_ORDER.map((id) => ({
    id,
    app: STEP_META[id].app,
    step: STEP_META[id].step,
    question: STEP_META[id].question,
    url: TARGET_URL[id],
    here: false,
  })),
];

export function buildHandoffSteps(d: Destination, ctx: HandoffContext = {}): HandoffStep[] {
  return HANDOFF_ORDER.map((id) => ({
    id,
    ...STEP_META[id],
    why: whyFor(d, id, ctx),
    url: handoffUrl(d, id, ctx),
  }));
}
