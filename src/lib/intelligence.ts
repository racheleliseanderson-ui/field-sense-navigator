import {
  daysSince,
  humanize,
  reviewOverdue,
  type Destination,
} from "@/lib/catalog";

/* ------------------------------------------------------------------ *
 * Signal extraction
 *
 * Everything below is derived ONLY from the documented record: notices,
 * verification requirements, published access facilities and freshness of
 * the last source check. Nothing here models live gauge height, flow,
 * hatch activity, bite windows or catch outcomes — those are declared as
 * residual unknowns rather than estimated.
 * ------------------------------------------------------------------ */

export type Grade = "clear" | "watch" | "flagged" | "restricted";

const HAZARD_PATTERNS: Array<{ tag: string; label: string; rx: RegExp }> = [
  { tag: "wind", label: "Wind & fetch", rx: /wind|fetch|small.craft|gust|chop|squall|rough water/i },
  { tag: "tide", label: "Tide stage", rx: /\btide|tidal|flats\b/i },
  { tag: "fog", label: "Visibility / fog", rx: /\bfog\b|visibility/i },
  { tag: "fire", label: "Wildfire & smoke", rx: /wildfire|smoke|fire restriction|fire danger/i },
  { tag: "algae", label: "Algal advisory", rx: /\bhab\b|algal|algae|blue-?green|toxin/i },
  { tag: "level", label: "Water level & submerged hazards", rx: /low water|water level|drawdown|stump|unmarked hazard|shoal|shallow|sandbar/i },
  { tag: "current", label: "Current & flow", rx: /\bcurrent\b|\bflows?\b|rapids|whitewater|dam release|discharge|swift/i },
  { tag: "traffic", label: "Commercial & vessel traffic", rx: /commercial shipping|shipping traffic|barge|freighter|navigation planning|boat traffic/i },
  { tag: "ice", label: "Ice & cold exposure", rx: /\bice\b|frozen|cold water|hypotherm/i },
  { tag: "remote", label: "Remoteness & comms", rx: /remote|no cell|backcountry|wilderness|long walk|primitive/i },
];

const CROWD_PATTERNS: Array<{ tag: string; label: string; rx: RegExp }> = [
  { tag: "parking", label: "Parking capacity", rx: /parking/i },
  { tag: "ramp", label: "Ramp queueing", rx: /ramp queue|queue|launch congestion|ramp congestion/i },
  { tag: "congestion", label: "General congestion", rx: /congest|crowd|busy|heavy use|peak/i },
  { tag: "weekend", label: "Weekend / holiday load", rx: /weekend|holiday/i },
  { tag: "tourism", label: "Seasonal tourism load", rx: /tourism|tourist|visitor season/i },
  { tag: "permit", label: "Permit, fee or reservation", rx: /permit|reservation|fee|day.use pass|entry pass/i },
  { tag: "hours", label: "Operating hours", rx: /hours|gate|open year-?round|day use/i },
];

const SEASONAL_PATTERNS: Array<{ tag: string; label: string; rx: RegExp }> = [
  { tag: "season", label: "Season dates", rx: /season|spawn|run\b|migration|stocking/i },
  { tag: "gear", label: "Gear & method restrictions", rx: /gear rule|selective gear|artificial|barbless|tackle restriction|method/i },
  { tag: "closure", label: "Closure in effect or possible", rx: /closure|closed|suspended|prohibited/i },
  { tag: "regs", label: "Regulation variance by section", rx: /regulation|slot|limit|size limit|rule change|special rule/i },
  { tag: "ais", label: "AIS inspection / decontamination", rx: /\bais\b|invasive|clean-?drain-?dry|inspection|decontam/i },
  { tag: "jurisdiction", label: "Multi-jurisdiction rules", rx: /jurisdiction|ontario|tribal|reciproc|boundary water|interstate|two states/i },
];

const SHORE_ACCESS_RX = /shore|pier|bank|jetty|beach|dock|walk|trail|park_access|fishing_platform/i;
const LAUNCH_RX = /boat_launch|ramp|marina|harbor|boat_access/i;
const HAND_LAUNCH_RX = /hand|cartop|carry|canoe|kayak|paddle|non-?motor/i;
const DIRECTORY_RX = /directory|finder|multiple_official_access_sites|network|map/i;
const CLOSED_RX = /closed|unavailable|out of service|removed/i;

export interface Signal {
  label: string;
  detail: string;
}

function match(
  lines: string[],
  patterns: Array<{ tag: string; label: string; rx: RegExp }>,
) {
  const tags = new Set<string>();
  const signals: Signal[] = [];
  for (const line of lines) {
    for (const p of patterns) {
      if (p.rx.test(line) && !tags.has(p.tag)) {
        tags.add(p.tag);
        signals.push({ label: p.label, detail: line });
      }
    }
  }
  return { tags, signals };
}

export interface WaterTags {
  hazards: Set<string>;
  crowd: Set<string>;
  seasonal: Set<string>;
  hasOpenLaunch: boolean;
  hasClosedLaunch: boolean;
  hasShoreAccess: boolean;
  hasHandLaunch: boolean;
  directoryOnly: boolean;
  restricted: boolean;
  namedSites: number;
}

export function readTags(d: Destination): WaterTags {
  const lines = [...d.currentNotices, ...d.directVerification, humanize(d.status)];
  const accessText = d.publicAccess
    .map((a) => `${a.name} ${a.type} ${a.status ?? ""}`)
    .join(" ");

  const hazards = match([...lines, accessText], HAZARD_PATTERNS).tags;
  const crowd = match([...lines, accessText], CROWD_PATTERNS).tags;
  const seasonal = match([...lines, accessText], SEASONAL_PATTERNS).tags;

  const launches = d.publicAccess.filter(
    (a) => LAUNCH_RX.test(a.type) || LAUNCH_RX.test(a.name),
  );
  const hasClosedLaunch = launches.some((a) => CLOSED_RX.test(a.status ?? ""));
  const hasOpenLaunch = launches.some((a) => !CLOSED_RX.test(a.status ?? ""));
  const directoryOnly =
    d.publicAccess.length > 0 &&
    d.publicAccess.every((a) => DIRECTORY_RX.test(a.type) || DIRECTORY_RX.test(a.name));

  return {
    hazards,
    crowd,
    seasonal,
    hasOpenLaunch,
    hasClosedLaunch,
    hasShoreAccess: d.publicAccess.some(
      (a) => SHORE_ACCESS_RX.test(a.type) || SHORE_ACCESS_RX.test(a.name),
    ),
    hasHandLaunch:
      d.publicAccess.some(
        (a) => HAND_LAUNCH_RX.test(a.type) || HAND_LAUNCH_RX.test(a.name),
      ) || /hand-?launch|kayak|paddleboard|canoe|cartop/i.test(d.currentNotices.join(" ")),
    directoryOnly,
    restricted: /restricted/i.test(d.status) || hasClosedLaunch,
    namedSites: d.publicAccess.filter(
      (a) => !DIRECTORY_RX.test(a.type) && !DIRECTORY_RX.test(a.name),
    ).length,
  };
}

/* ------------------------------------------------------------------ *
 * Intelligence layers
 * ------------------------------------------------------------------ */

export type LayerKey =
  | "access"
  | "conditions"
  | "capacity"
  | "seasonal"
  | "fieldcheck";

export interface IntelLayer {
  key: LayerKey;
  index: string;
  title: string;
  readout: string;
  grade: Grade;
  confidence: number;
  confidenceLabel: "High" | "Moderate" | "Low";
  signals: Signal[];
  unknowns: string[];
}

function confidenceLabel(pct: number): IntelLayer["confidenceLabel"] {
  if (pct >= 70) return "High";
  if (pct >= 50) return "Moderate";
  return "Low";
}

function freshnessBonus(d: Destination): number {
  const age = daysSince(d.checkedAt);
  if (reviewOverdue(d)) return -12;
  if (age <= 7) return 10;
  if (age <= 21) return 4;
  if (age <= 60) return -2;
  return -10;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function buildLayers(d: Destination): IntelLayer[] {
  const t = readTags(d);
  const fresh = freshnessBonus(d);
  const lines = [...d.currentNotices, ...d.directVerification];

  const hazardSignals = match(lines, HAZARD_PATTERNS).signals;
  const crowdSignals = match(lines, CROWD_PATTERNS).signals;
  const seasonalSignals = match(lines, SEASONAL_PATTERNS).signals;

  /* --- Layer 1: Access & legality --- */
  const accessSignals: Signal[] = d.publicAccess.map((a) => ({
    label: humanize(a.type),
    detail: a.status ? `${a.name} — ${humanize(a.status)}` : a.name,
  }));
  const accessGrade: Grade = t.hasClosedLaunch || /restricted/i.test(d.status)
    ? "restricted"
    : t.directoryOnly
      ? "watch"
      : "clear";
  const accessReadout = t.hasClosedLaunch
    ? "Published access exists, but at least one launch is documented closed. Treat the water as partially open."
    : t.directoryOnly
      ? "Access is documented as an official directory, not a single site. One named site must be chosen before travel."
      : `${t.namedSites} named public facilit${t.namedSites === 1 ? "y" : "ies"} documented on the official source.`;

  /* --- Layer 2: Conditions & hazards --- */
  const hazardCount = t.hazards.size;
  const conditionsGrade: Grade =
    hazardCount >= 4 ? "flagged" : hazardCount >= 2 ? "watch" : "clear";
  const conditionsReadout = hazardCount
    ? `${hazardCount} documented hazard famil${hazardCount === 1 ? "y" : "ies"} on record. These are standing characteristics of the water, not a forecast.`
    : "No standing hazard families recorded on the official notices. Weather still governs the day.";

  /* --- Layer 3: Capacity & crowding --- */
  const crowdCount = t.crowd.size;
  const capacityGrade: Grade =
    crowdCount >= 4 ? "flagged" : crowdCount >= 2 ? "watch" : "clear";
  const capacityReadout = crowdCount
    ? `${crowdCount} capacity pressure signal${crowdCount === 1 ? "" : "s"} documented. Signals describe typical load, never live occupancy.`
    : "No documented capacity pressure. Expect ordinary parking and launch behaviour, unverified.";

  /* --- Layer 4: Seasonal & regulatory pressure --- */
  const seasonalCount = t.seasonal.size;
  const seasonalGrade: Grade =
    seasonalCount >= 4 ? "flagged" : seasonalCount >= 2 ? "watch" : "clear";
  const seasonalReadout = seasonalCount
    ? `${seasonalCount} regulatory pressure point${seasonalCount === 1 ? "" : "s"}. Rules here move with date, section and vessel.`
    : "No section-specific regulatory variance recorded. Statewide rules still apply.";

  /* --- Layer 5: Field-check requirement --- */
  const checkCount = d.directVerification.length;
  const fieldGrade: Grade = checkCount >= 4 ? "flagged" : checkCount >= 2 ? "watch" : "clear";

  return [
    {
      key: "access",
      index: "01",
      title: "Access & legality",
      readout: accessReadout,
      grade: accessGrade,
      confidence: clamp(46 + accessSignals.length * 9 + fresh, 22, 88),
      confidenceLabel: "Moderate",
      signals: accessSignals,
      unknowns: [
        "Same-day gate hours, fees and closures are set locally and are not mirrored here.",
        t.directoryOnly
          ? "The specific site you will use has not been chosen yet — this record covers the network, not one ramp."
          : "Facility condition (surface, dock presence, ADA status) is not tracked at record level.",
        "Landowner boundaries adjacent to public corridors are outside this dataset.",
      ],
    },
    {
      key: "conditions",
      index: "02",
      title: "Conditions & hazards",
      readout: conditionsReadout,
      grade: conditionsGrade,
      confidence: clamp(40 + hazardSignals.length * 8 + fresh, 20, 82),
      confidenceLabel: "Moderate",
      signals: hazardSignals,
      unknowns: [
        "No live gauge height, discharge, tide table or wind reading is held in this record.",
        "Water clarity, temperature and hatch activity are not modelled and will not be estimated.",
        "Hazard families describe what the water is known to do, not what it is doing today.",
      ],
    },
    {
      key: "capacity",
      index: "03",
      title: "Capacity & crowding",
      readout: capacityReadout,
      grade: capacityGrade,
      confidence: clamp(34 + crowdSignals.length * 9 + fresh, 18, 74),
      confidenceLabel: "Low",
      signals: crowdSignals,
      unknowns: [
        "Live lot occupancy, ramp queue length and trailer counts are not observable from here.",
        "Event, tournament and regatta calendars are not ingested.",
        "Crowding language reflects documented patterns, not a prediction for your date.",
      ],
    },
    {
      key: "seasonal",
      index: "04",
      title: "Seasonal & regulatory pressure",
      readout: seasonalReadout,
      grade: seasonalGrade,
      confidence: clamp(44 + seasonalSignals.length * 8 + fresh, 20, 80),
      confidenceLabel: "Moderate",
      signals: seasonalSignals,
      unknowns: [
        "The regulation booklet is authoritative; this layer flags where variance exists, it does not restate the rule.",
        "Emergency orders and in-season rule changes can post after the last source check.",
        "Species presence is context, never a catch expectation.",
      ],
    },
    {
      key: "fieldcheck",
      index: "05",
      title: "Field-check requirement",
      readout: `${checkCount} verification${checkCount === 1 ? "" : "s"} must be completed on the day of travel before this water is considered go.`,
      grade: fieldGrade,
      confidence: clamp(64 + fresh, 30, 90),
      confidenceLabel: "High",
      signals: d.directVerification.map((v, i) => ({
        label: `Check ${String(i + 1).padStart(2, "0")}`,
        detail: v,
      })),
      unknowns: [
        "Checks are the operator's responsibility; nothing here completes them for you.",
        "If a check cannot be completed, the water is treated as not-go by default.",
      ],
    },
  ].map((l) => ({
    ...l,
    confidenceLabel: confidenceLabel(l.confidence),
  })) as IntelLayer[];
}

/* ------------------------------------------------------------------ *
 * Field Readiness Score
 * ------------------------------------------------------------------ */

export interface ScorePart {
  label: string;
  value: number;
  max: number;
  note: string;
}

export interface Readiness {
  score: number;
  band: "Ready to plan" | "Plan with checks" | "Plan carefully" | "Constrained";
  grade: Grade;
  parts: ScorePart[];
  cannotKnow: string[];
}

export function readiness(d: Destination): Readiness {
  const t = readTags(d);
  const age = daysSince(d.checkedAt);
  const overdue = reviewOverdue(d);

  const accessValue = clamp(
    30 -
      (t.hasClosedLaunch ? 10 : 0) -
      (t.directoryOnly ? 9 : 0) -
      (/restricted/i.test(d.status) ? 8 : 0) +
      Math.min(4, t.namedSites),
    4,
    30,
  );

  const freshValue = clamp(
    25 - Math.floor(age / 7) * 3 - (overdue ? 8 : 0),
    3,
    25,
  );

  const hazardValue = clamp(20 - t.hazards.size * 3, 4, 20);
  const crowdValue = clamp(10 - t.crowd.size * 2, 2, 10);
  const regValue = clamp(15 - t.seasonal.size * 2, 3, 15);

  const parts: ScorePart[] = [
    {
      label: "Access clarity",
      value: accessValue,
      max: 30,
      note: t.hasClosedLaunch
        ? "Documented closure on at least one launch."
        : t.directoryOnly
          ? "A named site still has to be selected from the official directory."
          : `${t.namedSites} named public facilities on record.`,
    },
    {
      label: "Record freshness",
      value: freshValue,
      max: 25,
      note: overdue
        ? `Source check is past its review date (${d.nextReviewAt}).`
        : `Official source last checked ${age} day${age === 1 ? "" : "s"} ago.`,
    },
    {
      label: "Hazard load",
      value: hazardValue,
      max: 20,
      note: t.hazards.size
        ? `${t.hazards.size} standing hazard families documented.`
        : "No standing hazard families on record.",
    },
    {
      label: "Capacity headroom",
      value: crowdValue,
      max: 10,
      note: t.crowd.size
        ? `${t.crowd.size} documented crowding pressures.`
        : "No documented crowding pressure.",
    },
    {
      label: "Regulatory certainty",
      value: regValue,
      max: 15,
      note: t.seasonal.size
        ? `${t.seasonal.size} areas where rules vary by date, section or vessel.`
        : "No section-level regulatory variance recorded.",
    },
  ];

  const score = parts.reduce((sum, p) => sum + p.value, 0);

  const band: Readiness["band"] =
    score >= 82
      ? "Ready to plan"
      : score >= 66
        ? "Plan with checks"
        : score >= 48
          ? "Plan carefully"
          : "Constrained";

  const grade: Grade =
    score >= 82 ? "clear" : score >= 66 ? "watch" : score >= 48 ? "flagged" : "restricted";

  return {
    score,
    band,
    grade,
    parts,
    cannotKnow: [
      "Live gauge height, flow, tide stage, water temperature or clarity.",
      "Today's weather, wind speed or lake state at the ramp.",
      "Whether fish are feeding, or any catch outcome whatsoever.",
      "Real-time parking, queue length or facility staffing.",
      "Any private, unpublished or user-supplied spot — those are out of scope by design.",
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Job-aware ranking
 * ------------------------------------------------------------------ */

export type JobId =
  | "bank"
  | "kayak"
  | "small_boat"
  | "scouting"
  | "tournament"
  | "family";

export interface JobDef {
  id: JobId;
  label: string;
  blurb: string;
}

export const JOBS: JobDef[] = [
  { id: "bank", label: "Bank & shoreline", blurb: "On foot from public shore, pier or park frontage." },
  { id: "kayak", label: "Kayak & paddle", blurb: "Hand-launched craft, wind-sensitive, short haul from the car." },
  { id: "small_boat", label: "Small boat", blurb: "Trailered craft needing a usable hard-surface ramp." },
  { id: "scouting", label: "Scouting", blurb: "Learning a new water. Depth of documentation matters most." },
  { id: "tournament", label: "Tournament-adjacent", blurb: "Pre-fish and rule-exposure work around organised events." },
  { id: "family", label: "Family day", blurb: "Low commitment, low hazard, facilities and short walks." },
];

export type TimeWindow = "short" | "day" | "multi";
export type WindTolerance = "low" | "moderate" | "high";
export type GearMode = "shore_only" | "hand_launch" | "trailer";

export interface Constraints {
  timeWindow: TimeWindow;
  wind: WindTolerance;
  gear: GearMode;
  states: string[];
  waterTypes: string[];
}

export const DEFAULT_CONSTRAINTS: Constraints = {
  timeWindow: "day",
  wind: "moderate",
  gear: "shore_only",
  states: [],
  waterTypes: [],
};

export interface Fit {
  destination: Destination;
  score: number;
  readiness: Readiness;
  reasons: string[];
  cautions: string[];
  blocked: string | null;
}

const BIG_WATER = /superior|michigan|huron|erie|ontario|flathead|puget|bay|gulf|coast|sound|harbor|ocean|atlantic|pacific/i;

export function fitFor(
  d: Destination,
  job: JobId,
  c: Constraints,
): Fit {
  const t = readTags(d);
  const r = readiness(d);
  const reasons: string[] = [];
  const cautions: string[] = [];
  let blocked: string | null = null;
  let score = r.score * 0.55;

  const bigWater = BIG_WATER.test(`${d.waterbody} ${d.region}`) || d.waterType === "marine";

  /* ---- fail-closed gear gates ---- */
  if (c.gear === "trailer") {
    if (!t.hasOpenLaunch) {
      blocked =
        t.hasClosedLaunch
          ? "Documented launch closure — no open trailer ramp on record."
          : "No trailer-capable ramp documented on this record.";
    } else {
      reasons.push("Open trailer ramp documented on the official source.");
      score += 12;
    }
  }
  if (c.gear === "hand_launch") {
    if (t.hasHandLaunch) {
      reasons.push("Hand-launch or cartop access documented.");
      score += 10;
    } else if (!t.hasOpenLaunch && !t.hasShoreAccess) {
      blocked = "No hand-launch, shore or open ramp access documented.";
    } else {
      cautions.push("Hand-launch suitability is not explicitly documented — confirm at the site.");
      score -= 4;
    }
  }
  if (c.gear === "shore_only") {
    if (t.hasShoreAccess) {
      reasons.push("Public shore, pier or park frontage documented.");
      score += 12;
    } else {
      cautions.push("Shore access is not explicitly named; the record is launch-led.");
      score -= 8;
    }
  }

  /* ---- job shaping ---- */
  switch (job) {
    case "bank":
      if (t.hasShoreAccess) score += 10;
      if (d.waterType === "river") score += 4;
      if (t.directoryOnly) {
        cautions.push("Shore-fishing quality varies site to site across this network.");
        score -= 6;
      }
      break;
    case "kayak":
      if (t.hasHandLaunch) score += 8;
      if (bigWater) {
        cautions.push("Big-water fetch — paddle craft exposure is real here.");
        score -= 14;
      }
      if (t.hazards.has("traffic")) {
        cautions.push("Commercial or heavy vessel traffic documented.");
        score -= 8;
      }
      if (t.hazards.has("current")) {
        cautions.push("Current and flow are documented factors.");
        score -= 5;
      }
      break;
    case "small_boat":
      if (d.waterType === "reservoir" || d.waterType === "lake") score += 6;
      if (t.hazards.has("level")) {
        cautions.push("Level swings can expose unmarked hazards and disable ramps.");
        score -= 7;
      }
      if (t.crowd.has("ramp") || t.crowd.has("parking")) {
        cautions.push("Ramp and parking pressure documented — plan an early window.");
        score -= 4;
      }
      break;
    case "scouting":
      score += Math.min(12, d.publicAccess.length * 3 + d.currentNotices.length);
      if (t.directoryOnly) {
        reasons.push("Official directory access — many candidate sites to compare.");
        score += 6;
      }
      if (t.restricted) {
        cautions.push("Restricted status limits what a scouting trip can cover.");
        score -= 8;
      }
      break;
    case "tournament":
      if (t.hasOpenLaunch) score += 8;
      if (t.seasonal.size >= 2) {
        cautions.push("Rule variance is high — confirm the exact section rules in writing.");
        score -= 6;
      }
      if (t.crowd.size >= 3) {
        cautions.push("Heavy documented congestion around this water.");
        score -= 6;
      }
      if (d.speciesContext.length >= 4) {
        reasons.push("Broad documented species context for pattern work.");
        score += 4;
      }
      break;
    case "family":
      if (t.crowd.has("hours") || t.crowd.has("permit")) score += 3;
      if (t.hasShoreAccess) score += 8;
      score -= t.hazards.size * 4;
      if (bigWater) {
        cautions.push("Open-water exposure is not a soft first outing.");
        score -= 10;
      }
      break;
  }

  /* ---- constraints ---- */
  const windWeight = c.wind === "low" ? 9 : c.wind === "moderate" ? 5 : 2;
  if (t.hazards.has("wind")) {
    score -= windWeight;
    cautions.push("Wind and fetch are documented characteristics of this water.");
  }
  if (bigWater && c.wind === "low") {
    score -= 8;
  }

  if (c.timeWindow === "short") {
    if (t.directoryOnly) {
      score -= 10;
      cautions.push("Site selection research is required before a short window can work.");
    }
    if (t.restricted) score -= 6;
    if (d.directVerification.length >= 4) score -= 4;
  }
  if (c.timeWindow === "multi") {
    score += Math.min(6, d.publicAccess.length * 2);
  }

  if (t.restricted && !blocked) {
    cautions.push("Restricted-access notice on record — read layer 01 before committing.");
  }

  if (reviewOverdue(d)) {
    cautions.push("Record is past its review date; treat every layer as provisional.");
    score -= 6;
  }

  return {
    destination: d,
    score: clamp(Math.round(score), 0, 100),
    readiness: r,
    reasons,
    cautions,
    blocked,
  };
}

export function rank(
  pool: Destination[],
  job: JobId,
  c: Constraints,
): { fits: Fit[]; excluded: Fit[] } {
  const filtered = pool.filter(
    (d) =>
      (c.states.length === 0 || c.states.includes(d.state)) &&
      (c.waterTypes.length === 0 || c.waterTypes.includes(d.waterType)),
  );
  const all = filtered.map((d) => fitFor(d, job, c));
  return {
    fits: all.filter((f) => !f.blocked).sort((a, b) => b.score - a.score),
    excluded: all.filter((f) => f.blocked).sort((a, b) => b.score - a.score),
  };
}

/* ------------------------------------------------------------------ *
 * Same-day field-check generation
 * ------------------------------------------------------------------ */

export interface CheckItem {
  group: "Before you leave" | "At the access" | "On the water" | "Standing rules";
  text: string;
  source: string;
}

export function buildChecklist(
  d: Destination,
  job: JobId | null,
  c: Constraints | null,
): CheckItem[] {
  const t = readTags(d);
  const items: CheckItem[] = [];
  const add = (group: CheckItem["group"], text: string, source: string) =>
    items.push({ group, text, source });

  for (const v of d.directVerification) {
    add("Before you leave", v, "Record: required verification");
  }

  add(
    "Before you leave",
    `Open the official source and confirm nothing has changed since ${new Date(d.checkedAt).toISOString().slice(0, 10)}.`,
    "Record: source freshness",
  );

  if (t.directoryOnly) {
    add(
      "Before you leave",
      "Select ONE named public access site from the official directory and write it down. Do not depart against a network.",
      "Layer 01: access is directory-level",
    );
  }
  if (t.hasClosedLaunch) {
    add(
      "Before you leave",
      "Confirm which launches are open today — at least one is documented closed.",
      "Layer 01: documented closure",
    );
  }
  if (t.hazards.has("wind")) {
    add("Before you leave", "Pull the wind forecast and set a turn-back speed before you commit.", "Layer 02: wind & fetch");
  }
  if (t.hazards.has("tide")) {
    add("Before you leave", "Read the tide table for your window; note the stage that strands you.", "Layer 02: tide stage");
  }
  if (t.hazards.has("level")) {
    add("Before you leave", "Check current water level and ramp usability; assume unmarked hazards where levels are low.", "Layer 02: water level");
  }
  if (t.hazards.has("fire")) {
    add("Before you leave", "Check wildfire closures, smoke and fire restrictions for the corridor.", "Layer 02: wildfire & smoke");
  }
  if (t.hazards.has("algae")) {
    add("Before you leave", "Check current algal-bloom advisories before contact recreation.", "Layer 02: algal advisory");
  }
  if (t.seasonal.has("ais")) {
    add("Before you leave", "Clean, drain, dry. Confirm inspection or decontamination requirements for this water.", "Layer 04: AIS obligation");
  }
  if (t.seasonal.has("jurisdiction")) {
    add("Before you leave", "Confirm which jurisdiction governs the exact section you intend to fish.", "Layer 04: multi-jurisdiction");
  }
  if (t.seasonal.size) {
    add("Standing rules", "Read the current regulation entry for this water — season dates, gear and limits vary by section.", "Layer 04: regulatory pressure");
  }

  if (t.crowd.size) {
    add("At the access", "Have a named fallback access in case parking or the ramp is full on arrival.", "Layer 03: capacity pressure");
  }
  if (t.crowd.has("permit")) {
    add("At the access", "Carry the required permit, pass or fee payment method.", "Layer 03: permit or fee");
  }
  if (t.crowd.has("hours")) {
    add("At the access", "Confirm gate and day-use hours, including the closing time.", "Layer 03: operating hours");
  }
  add("At the access", "Confirm posted signage matches what this packet says. Posted signage wins.", "Standing policy");
  add("At the access", "Note the exact access name and managing authority in your log.", "Standing policy");

  if (job === "kayak" || c?.gear === "hand_launch") {
    add("On the water", "PFD worn, not stowed. Confirm your re-entry plan and shoreline bail-out points.", "Job: paddle craft");
  }
  if (job === "small_boat" || c?.gear === "trailer") {
    add("On the water", "Check ramp surface and depth before backing in; confirm safety gear and kill-switch.", "Job: trailered craft");
  }
  if (job === "bank" || c?.gear === "shore_only") {
    add("On the water", "Stay on the public corridor. Where public and private land interleave, assume private and step back.", "Job: shoreline");
  }
  if (job === "family") {
    add("On the water", "Set a hard turn-around time and a fixed regroup point at the access.", "Job: family day");
  }
  if (job === "tournament") {
    add("Standing rules", "Confirm event boundary, off-limits periods and permitted launches in writing.", "Job: tournament-adjacent");
  }
  if (job === "scouting") {
    add("On the water", "Log access condition, parking count and hazards observed for the next visit.", "Job: scouting");
  }
  if (t.hazards.has("traffic")) {
    add("On the water", "Stay clear of the navigation channel; commercial traffic has right of way and long stopping distance.", "Layer 02: vessel traffic");
  }
  if (t.hazards.has("current")) {
    add("On the water", "Read current before wading or anchoring; flows can change with releases.", "Layer 02: current & flow");
  }
  if (t.hazards.has("ice") ) {
    add("On the water", "Cold-water exposure planning: layers, change of clothes, immersion plan.", "Layer 02: cold exposure");
  }

  add(
    "Standing rules",
    "If any check above cannot be completed, this water is NOT GO for the day. Fail closed.",
    "Standing policy",
  );

  return items;
}

export const CHECK_GROUPS: CheckItem["group"][] = [
  "Before you leave",
  "At the access",
  "On the water",
  "Standing rules",
];

/* ------------------------------------------------------------------ *
 * Handoff to Horizon Desk / Trip Prep
 * ------------------------------------------------------------------ */

export function buildHandoff(
  d: Destination,
  job: JobId | null,
  c: Constraints | null,
): string {
  const r = readiness(d);
  const t = readTags(d);
  const jobLabel = JOBS.find((j) => j.id === job)?.label ?? "Not declared";
  return [
    "FIELD SENSE NAVIGATOR — CARRY FORWARD",
    `Record: ${d.id} (schema 0.4.0)`,
    `Water: ${d.waterbody}${d.accessSite ? ` — ${d.accessSite}` : ""}`,
    `Place: ${d.region}, ${d.state}${d.county ? ` (${d.county} County)` : ""}`,
    `Type: ${d.waterType} · Boundary: public waters only`,
    `Job: ${jobLabel}${c ? ` · Gear: ${humanize(c.gear)} · Window: ${c.timeWindow} · Wind tolerance: ${c.wind}` : ""}`,
    `Field Readiness: ${r.score}/100 — ${r.band}`,
    `Status: ${humanize(d.status)}`,
    `Last source check: ${d.checkedAt.slice(0, 10)} · Next review: ${d.nextReviewAt}`,
    `Official source: ${d.officialSourceUrl}`,
    "",
    "OPEN ITEMS (must clear before departure):",
    ...d.directVerification.map((v, i) => `  ${i + 1}. ${v}`),
    "",
    `Hazard families: ${t.hazards.size ? [...t.hazards].join(", ") : "none recorded"}`,
    `Capacity pressure: ${t.crowd.size ? [...t.crowd].join(", ") : "none recorded"}`,
    "",
    "NOT INCLUDED: live gauge, flow, tide, weather, bite or catch data. No private spots, no coordinates.",
  ].join("\n");
}