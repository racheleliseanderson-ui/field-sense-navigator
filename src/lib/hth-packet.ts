/**
 * Hook the Horizon — the shared cross-app packet protocol (HTH-1.0).
 *
 * ONE FILE, COPIED VERBATIM INTO SEVEN REPOSITORIES.
 *
 * There is no monorepo and no npm package behind this fleet. Seven separately
 * deployed applications pass context to each other in a URL fragment, and every
 * one of them hand-rolled its own reader and writer. The result was a protocol
 * that barely interoperated:
 *
 *   - Species & Presentation read `species.id`, Field Ops wrote `species.speciesId`;
 *   - Rig Signal read nothing at all and emitted nothing, while the Field Ops Desk
 *     had a reader waiting for it;
 *   - Hatch Match emitted a private base64url dialect that every URI-JSON reader
 *     in the fleet failed on *silently*, so a failed carry looked like no carry;
 *   - Hatch Match also emitted no envelope at all — `applicationId` and
 *     `schemaVersion` instead of `packetVersion` and `fleet.contract`;
 *   - Field Sense emitted twelve fields that receivers dropped on the floor;
 *   - the Field Ops Desk measured packet age from `createdAt`, which some senders
 *     do not emit, so its freshness gate resolved to "no reliable timestamp"
 *     forever;
 *   - and nobody validated the version, so a future HTH-2.0 packet would have
 *     been half-read as if it were this one.
 *
 * This file is the single answer to all of that. Because it is copied rather
 * than imported, it has **zero dependencies outside the JavaScript standard
 * library** — no `@/` paths, no npm packages, no framework types. Anything
 * app-specific belongs in the app, not here.
 *
 * ---------------------------------------------------------------------------
 * THE FOUR RULES. Change these only by changing the protocol version.
 * ---------------------------------------------------------------------------
 *
 * 1. THE TRAIL APPENDS, IT NEVER REPLACES.
 *    `fleet.trail` is the route the context actually travelled. It is the only
 *    record of provenance that survives a five-app chain, and it is what
 *    `packetAge()` measures. An emitter that writes `trail: [{ origin: me }]`
 *    erases the route and resets the clock — a packet that has been sitting in
 *    a tab for six hours then looks brand new to the next receiver. So the
 *    incoming packet is EXTENDED, never replaced, and this file is the only
 *    place trail entries are constructed.
 *
 * 2. COORDINATES STRIP ON READ AS WELL AS ON WRITE.
 *    Stripping on write alone assumes every sender runs this file. Six of the
 *    seven apps did not, and the seventh (any future one) may not either. A
 *    receiver that strips only on write will happily take a `lat`/`lon` pair
 *    into its own state, persist it to localStorage, and re-emit it later from
 *    a code path that never saw the original packet. Stripping on read is what
 *    makes the no-coordinates promise a property of the FLEET rather than a
 *    property of a well-behaved sender. It costs one recursive walk.
 *
 * 3. A FAILED CARRY MUST NEVER LOOK LIKE A CARRY THAT NEVER HAPPENED.
 *    Hence `readPacket()` returns three states, not a nullable. `absent` means
 *    no packet was offered; `invalid` means one was offered and could not be
 *    honoured, and carries a reason a user can be shown. Collapsing those two
 *    into `null` is exactly the bug that let the base64url dialect fail
 *    unnoticed across the fleet for months.
 *
 * 4. THE VERSION GATE IS UNCONDITIONAL.
 *    `packetVersion` must be `HTH-1.0` and `fleet.contract` must be
 *    `HTH-FLEET-1.0`. A packet that declares neither is not "probably fine" —
 *    it is unversioned, and reading it half-way is how a field of the same name
 *    but a different meaning gets silently adopted. The one exception is the
 *    documented Hatch Match legacy stamp, which is repaired explicitly and
 *    reported in `normalizations`, never repaired silently.
 *
 * ---------------------------------------------------------------------------
 * THE CHAIN
 *   Water → Species → Forage/Hatch → Presentation → Tackle → Knot → Field Ops
 *   → Debrief.
 * Presentation has no application of its own; it is owned by Species &
 * Presentation. Rig Signal is an OPTIONAL device-validation sidecar that may be
 * entered from and returned to any step — it is not a chain position, and
 * nothing downstream may require it.
 * ---------------------------------------------------------------------------
 */

/* ========================================================================== *
 * Envelope constants
 * ========================================================================== */

export const PACKET_VERSION = "HTH-1.0" as const;
export const FLEET_CONTRACT = "HTH-FLEET-1.0" as const;

/** The fragment parameter the whole fleet agrees on. Never a query string: a
 *  query string is sent to the server, a fragment is not, and this packet
 *  describes where a person intends to go fishing. */
export const PACKET_PARAM = "packet" as const;

export type PacketVersion = typeof PACKET_VERSION;
export type FleetContractId = typeof FLEET_CONTRACT;

/**
 * A field that may be absent, may be explicitly null, or may carry a value.
 *
 * The explicit `| undefined` matters: several repos in this fleet compile with
 * `exactOptionalPropertyTypes`, under which `{ a?: string }` refuses an
 * assignment of `undefined`. Written this way the file compiles unchanged in
 * every repo whatever its tsconfig.
 */
export type Opt<T> = T | null | undefined;

/**
 * A closed vocabulary that still accepts a string this file has not heard of.
 *
 * The fleet's vocabularies genuinely drift — Field Sense writes
 * `tempSource: "official-gauge"`, Species & Presentation writes
 * `"official_station"` — and a shared type that rejected either would force one
 * repo to lie in its own domain. Known values are listed for autocomplete;
 * anything else still type-checks and still travels.
 */
export type Open<T extends string> = T | (string & {});

/* ========================================================================== *
 * Vocabulary
 *
 * Gathered from the two canonical emitters. Field Sense (`src/lib/handoff.ts`)
 * defines the envelope and the water/reading/logistics blocks; Species &
 * Presentation (`src/lib/protocol/vocab.ts`) defines the richer conditions
 * vocabulary, including the four separate saltwater types and the tide axis.
 * Both are represented here so neither has to widen its own types to talk to
 * the other.
 * ========================================================================== */

export const FRESHWATER_TYPES = ["flowing", "stillwater"] as const;
/** Four separate marine types on purpose: a surf trough, an oyster bar, a wreck
 *  and an offshore temperature break are four different vocabularies, and
 *  merging them into one `marine` would hand a surf angler a holding list about
 *  water they cannot reach. */
export const MARINE_TYPES = ["surf", "inshore", "nearshore", "offshore"] as const;
export const WATER_TYPES = [...FRESHWATER_TYPES, ...MARINE_TYPES] as const;
export type FleetWaterType = (typeof WATER_TYPES)[number];

export function isMarineWater(value: string): boolean {
  return (MARINE_TYPES as readonly string[]).includes(value);
}

/**
 * The canonical temperature-source spellings. Kebab-case, one dialect only.
 *
 * The fleet shipped two spellings of the same idea — `official-gauge` beside
 * `official_station`, `observed` beside `user_measured` — with nothing saying
 * which was which, so anything switching on the string had to handle both. The
 * kebab dialect wins because it is what the majority of senders already write
 * and what `EVIDENCE_CLASSES` below already uses.
 *
 * The snake spellings are still ACCEPTED on read (see `TEMP_SOURCE_ALIASES`),
 * normalised to these, and never emitted.
 */
export const TEMP_SOURCES = [
  "official-gauge",
  "official-observation",
  "official-station",
  "user-measured",
  "estimated",
  "unknown",
] as const;
export type TempSource = Open<(typeof TEMP_SOURCES)[number]>;

/**
 * Accepted-on-read spellings → the canonical one above.
 *
 * Read, normalised, and then gone: `normalizeVocabulary()` rewrites them so a
 * consumer only ever sees one spelling, and nothing in this file emits an
 * alias. Adding a row here is how the fleet absorbs a dialect instead of
 * asking a repo to lie about its own domain.
 */
export const TEMP_SOURCE_ALIASES: Record<string, TempSource> = {
  official_station: "official-station",
  user_measured: "user-measured",
};

export const FLOW_CLASSES = ["very_low", "low", "moderate", "elevated", "high", "unknown"] as const;
export type FlowClass = Open<(typeof FLOW_CLASSES)[number]>;

export const STILL_STATES = [
  "stable",
  "falling",
  "rising",
  "turnover_suspected",
  "stratified",
  "unknown",
] as const;
export type StillState = Open<(typeof STILL_STATES)[number]>;

export const TIDE_MOVEMENTS = ["flooding", "ebbing", "slack_high", "slack_low", "unknown"] as const;
export type TideMovement = Open<(typeof TIDE_MOVEMENTS)[number]>;

/** Suffixed because a bare `spring` collides with the season of the same name. */
export const TIDE_STRENGTHS = ["spring_tide", "average_tide", "neap_tide", "unknown"] as const;
export type TideStrength = Open<(typeof TIDE_STRENGTHS)[number]>;

export const CLARITY_CLASSES = [
  "very_clear",
  "clear",
  "lightly_stained",
  "stained",
  "turbid",
  "unknown",
] as const;
export type ClarityClass = Open<(typeof CLARITY_CLASSES)[number]>;

export const LIGHT_CLASSES = ["low_light", "mixed", "bright", "night", "unknown"] as const;
export type LightClass = Open<(typeof LIGHT_CLASSES)[number]>;

export const WEATHER_TRENDS = [
  "stable",
  "warming",
  "cooling",
  "frontal_change",
  "post_front",
  "unknown",
] as const;
export type WeatherTrend = Open<(typeof WEATHER_TRENDS)[number]>;

/**
 * Rig Signal's pressure-trend spellings → the canonical trends above.
 *
 * Rig Signal describes the same axis as a barometer reading — `falling`,
 * `rising`, `front_approaching` — and only `stable` and `post_front` overlap
 * with the list above. A packet carrying one of its spellings therefore lost
 * its pressure trend on the way into any instrument that switched on the
 * canonical set.
 *
 * The mapping is the one Rig Signal's own reader already implies: it treats
 * `front_approaching` and `falling` as the same falling-pressure case, and
 * `post_front` and `rising` as the same rising-pressure case.
 *
 * It is not symmetric, and it is worth saying why. `warming` and `cooling` have
 * no barometric spelling at all, and `falling` collapses into `frontal_change`,
 * which is the coarser word. So a value that round-trips through Rig Signal's
 * dialect and back comes home as `frontal_change`, not as whatever it started
 * as. That loss is in the vocabularies, not in this table; absorbing the
 * dialect is still better than dropping the axis on the floor.
 */
export const WEATHER_TREND_ALIASES: Record<string, WeatherTrend> = {
  falling: "frontal_change",
  front_approaching: "frontal_change",
  rising: "post_front",
};

export const SEASONS = [
  "winter",
  "early_spring",
  "spring",
  "early_summer",
  "summer",
  "late_summer",
  "fall",
  "late_fall",
  "unknown",
] as const;
export type Season = Open<(typeof SEASONS)[number]>;

export const FORAGE_CLASSES = [
  "aquatic_insects",
  "emerging_insects",
  "terrestrial_insects",
  "crustaceans",
  "small_forage_fish",
  "larger_prey_fish",
  "mollusks",
  "worms_annelids",
  "eggs",
  "amphibians",
  "zooplankton",
] as const;
export type ForageClass = Open<(typeof FORAGE_CLASSES)[number]>;

/**
 * How a provenance entry was come by. One dialect: kebab-case, same rule as
 * `TEMP_SOURCES`.
 *
 * `observed-retained` marks a real reading carried past its freshness window —
 * kept, but never quietly relabelled.
 */
export const EVIDENCE_CLASSES = [
  "probed",
  "declared",
  "device",
  "observed",
  "observed-retained",
  "user-measured",
  "official-station",
  "unknown",
] as const;
export type EvidenceClass = Open<(typeof EVIDENCE_CLASSES)[number]>;

/** Accepted-on-read evidence spellings → the canonical one above. */
export const EVIDENCE_CLASS_ALIASES: Record<string, EvidenceClass> = {
  user_measured: "user-measured",
  official_station: "official-station",
};

/* ========================================================================== *
 * The packet
 *
 * The shape below is derived from the canonical emitter, Field Sense
 * Navigator's `buildPacket()`. Nothing here is invented: every named field is
 * one Field Sense already writes, and the optional pass-through blocks are ones
 * other instruments already write into the same envelope.
 * ========================================================================== */

/** One hop. `origin` is the sender's own name for itself; `at` is an ISO stamp
 *  taken at the moment that sender built its packet. */
export type TrailEntry = {
  origin: string;
  at: string;
};

export type FleetBlock = {
  contract: string;
  /** Append-only. See rule 1. */
  trail: TrailEntry[];
  lastUpdatedBy: string;
};

export type StationRef = {
  id: string;
  name?: Opt<string>;
  agency?: Opt<string>;
};

export type WaterBlock = {
  waterId?: Opt<string>;
  waterName?: Opt<string>;
  /** The fleet's flow class. Field Sense maps its four editorial classes onto
   *  this; `waterClass` below keeps the finer original. */
  waterType?: Opt<Open<FleetWaterType>>;
  waterClass?: Opt<string>;
  region?: Opt<string>;
  state?: Opt<string>;
  jurisdiction?: Opt<string>;
  documentedSpecies?: Opt<string[]>;
  /** One species the reader picked out of `documentedSpecies`. Never inferred. */
  selectedSpecies?: Opt<string>;
  accessContext?: Opt<string>;
  managingAgency?: Opt<string>;
  officialSourceUrl?: Opt<string>;
  [key: string]: unknown;
};

export type ReadingCue = {
  family: string;
  title: string;
  [key: string]: unknown;
};

export type ReadingBlock = {
  waterClass?: Opt<string>;
  headline?: Opt<string>;
  cues?: Opt<ReadingCue[]>;
  /** What the record documents about how this water is shaped. Declared, not
   *  observed — never presented downstream as a measurement. */
  shaped?: Opt<string[]>;
  [key: string]: unknown;
};

export type LogisticsBlock = {
  namedSites?: Opt<number>;
  directoryOnly?: Opt<boolean>;
  trailerLaunch?: Opt<boolean>;
  handLaunch?: Opt<boolean>;
  shoreAccess?: Opt<boolean>;
  amenitiesPublished?: Opt<string[]>;
  [key: string]: unknown;
};

export type JobRef = {
  id: string;
  label: string;
};

export type ReadinessBlock = {
  score: number;
  band: string;
};

/** The one shape a temperature range is ever READ AS or WRITTEN AS. */
export type TempRangeF = { low: number; high: number };

/**
 * The shapes a temperature range is ACCEPTED IN.
 *
 * Three of them were already travelling: `{ low, high }`, the `[low, high]`
 * tuple Species & Presentation stores, and the `{ min, max }` pair Rig Signal's
 * reader falls back to. A receiver that understood only one read the other two
 * as "no range", which looks exactly like an angler who never took a reading.
 */
export type TempRangeFInput = TempRangeF | [number, number] | { min: number; max: number };

/**
 * Normalise any accepted range shape to `{ low, high }`, or null.
 *
 * Low and high are ordered rather than trusted — a sender that wrote them the
 * other way round meant a range, not an empty one — and a pair that is not two
 * finite numbers is dropped instead of being half-read.
 */
export function normalizeTempRangeF(value: unknown): TempRangeF | null {
  const pair = (a: unknown, b: unknown): TempRangeF | null => {
    if (typeof a !== "number" || typeof b !== "number") return null;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return { low: Math.min(a, b), high: Math.max(a, b) };
  };
  if (Array.isArray(value)) return value.length === 2 ? pair(value[0], value[1]) : null;
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  return pair(o["low"] ?? o["min"], o["high"] ?? o["max"]);
}

export type ConditionsBlock = {
  waterType?: Opt<Open<FleetWaterType>>;

  /* Water temperature. Water and air are separate fields on purpose: an air
   * temperature is not a substitute for a water temperature, and no receiver
   * may be able to read one as the other. Null is the honest answer whenever no
   * official station published a reading — the packet never estimates,
   * interpolates, or borrows from a neighbouring water. */
  tempF?: Opt<number>;
  tempUnit?: Opt<"F">;
  tempSource?: Opt<TempSource>;
  tempObservedAt?: Opt<string>;
  /** True when the reading is outside its freshness window and carried anyway.
   *  Carried, and labelled as carried. */
  tempRetained?: Opt<boolean>;
  tempStation?: Opt<StationRef>;

  /* Air temperature. Kept apart so no instrument can mistake air for water. */
  airTempF?: Opt<number>;
  airTempSource?: Opt<TempSource>;
  airTempObservedAt?: Opt<string>;
  airTempRetained?: Opt<boolean>;
  airTempStation?: Opt<StationRef>;

  /* The wider conditions vocabulary other instruments read and write. Optional
   * everywhere: an instrument that does not model an axis simply omits it, and
   * a receiver treats a missing axis as "do not apply it" rather than guessing. */
  /** ALWAYS `{ low, high }` once it has been through `readPacket()`. A sender
   *  may write the `[low, high]` tuple Species & Presentation uses, or the
   *  `{ min, max }` pair Rig Signal's reader accepts; both normalise to this
   *  and only this is ever emitted. See `normalizeTempRangeF()`. */
  tempRangeF?: Opt<TempRangeF>;
  flow?: Opt<FlowClass>;
  stillState?: Opt<StillState>;
  tideMovement?: Opt<TideMovement>;
  tideStrength?: Opt<TideStrength>;
  clarity?: Opt<ClarityClass>;
  light?: Opt<LightClass>;
  weather?: Opt<WeatherTrend>;
  season?: Opt<Season>;
  holding?: Opt<string>;
  [key: string]: unknown;
};

/**
 * A conditions block as a CALLER MAY WRITE IT, before normalisation.
 *
 * Identical to `ConditionsBlock` except that `tempRangeF` accepts every shape
 * the fleet ships. `buildPacket()` normalises it, so what leaves is always the
 * canonical block.
 */
export type ConditionsInput = Partial<Omit<ConditionsBlock, "tempRangeF">> & {
  tempRangeF?: Opt<TempRangeFInput>;
};

/**
 * Provenance describes the RECORD, not the moment the link was pressed.
 *
 * `reviewedAt` is the source's own check date; `builtAt` is when this packet was
 * assembled. Conflating them tells every downstream instrument that a
 * month-old record was verified this morning.
 */
export type ProvenanceEntry = {
  source: string;
  evidenceClass: EvidenceClass;
  reviewedAt?: Opt<string>;
  ageDays?: Opt<number>;
  humanReviewedAt?: Opt<string>;
  humanReviewedBy?: Opt<string>;
  nextReviewAt?: Opt<string>;
  builtAt?: Opt<string>;
  [key: string]: unknown;
};

/**
 * The privacy claim.
 *
 * It is the SENDER'S CLAIM, not a check the receiver ran — which is precisely
 * why `readPacket()` strips coordinates regardless of what this block says.
 * A receiver may show the claim; it may never rely on it.
 */
export type PrivacyBlock = {
  containsCoordinates: boolean;
  containsPrivateWater: boolean;
  [key: string]: unknown;
};

/**
 * The HTH-1.0 packet.
 *
 * The index signature is load-bearing: an instrument that adds its own block
 * (`claimEvaluation` from Rig Signal, `tackleEvaluation` from Tackle Link,
 * `knotDecision` from Knot Analyst, `hypotheses` and `presentationRequirements`
 * from Species & Presentation) must be able to do so without every other repo
 * shipping a new version of this file. Unknown blocks travel untouched.
 */
export type HthPacket = {
  packetVersion: string;
  origin: string;
  /** Which step the sender meant this packet for. Advisory: a receiver reads
   *  what it understands whatever the intent says. */
  intent?: Opt<string>;
  /** When THIS hop built the packet. A fallback timestamp only — age is
   *  measured from the trail. See `packetAge()`. */
  createdAt?: Opt<string>;
  instrumentId?: Opt<string>;
  fleet: FleetBlock;
  water?: Opt<WaterBlock>;
  reading?: Opt<ReadingBlock>;
  logistics?: Opt<LogisticsBlock>;
  job?: Opt<JobRef>;
  readiness?: Opt<ReadinessBlock>;
  openChecks?: Opt<string[]>;
  conditions?: Opt<ConditionsBlock>;
  provenance?: Opt<ProvenanceEntry[]>;
  privacy?: Opt<PrivacyBlock>;
  [key: string]: unknown;
};

/* ========================================================================== *
 * Rule 2 — coordinate stripping, in both directions
 * ========================================================================== */

/**
 * Key names that may never travel, in or out, at any depth, inside any array.
 *
 * The original fleet list held nine words (`coordinates`, `coordinate`,
 * `latitude`, `longitude`, `lat`, `lng`, `lon`, `gps`, `geometry`) and leaked
 * through every one of `coords`, `point`, `position`, `location`, `geo`,
 * `geojson`, `bbox`, `centroid`, `waypoint` and `pin` — all of which are what
 * a mapping library, a GeoJSON feature or a hand-rolled marker object actually
 * calls the same number pair.
 *
 * Matching is on the KEY only, lower-cased. Values are never inspected, so the
 * holding class `point` and the season `spring` travel untouched; only a field
 * NAMED `point` is removed. That is deliberate — a denylist that guessed at
 * values would eventually delete a legitimate reading.
 */
export const COORDINATE_KEYS: ReadonlySet<string> = new Set([
  "coordinates",
  "coordinate",
  "coord",
  "coords",
  "lat",
  "lng",
  "lon",
  "latitude",
  "longitude",
  "gps",
  "geo",
  "geojson",
  "geometry",
  "bbox",
  "centroid",
  "point",
  "position",
  "location",
  "waypoint",
  "pin",
]);

function stripValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripValue);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (COORDINATE_KEYS.has(key.toLowerCase())) continue;
    out[key] = stripValue(child);
  }
  return out;
}

/**
 * Remove every coordinate-shaped key, recursively, including inside arrays.
 *
 * Applied on READ and on WRITE. Stripping only on write would assume every
 * sender runs this file; six of the seven did not. Stripping on read is what
 * stops a receiver adopting a stranger's `lat`/`lon` into its own state,
 * persisting it, and re-emitting it later from a code path that never saw the
 * original packet.
 */
export function stripCoordinates<T>(value: T): T {
  return stripValue(value) as T;
}

/**
 * Strip, then re-state the privacy claim.
 *
 * TWO FIELDS, TWO DIFFERENT RULES, AND THE DIFFERENCE IS THE WHOLE POINT.
 *
 * `containsCoordinates: false` may be re-asserted here, because the walk above
 * has just run and this is no longer the sender's word for it — it is a fact
 * about the object being returned.
 *
 * `containsPrivateWater` may NOT. This file removes no private water; it has no
 * idea what water is private. The flag is one sender's warning to everybody
 * downstream, and an instrument that re-emits carries it whether or not it
 * agrees. So it is OR-ed forward, never re-stated: an incoming `true` survives
 * every hop after it. Writing `false` here unconditionally — which this
 * function used to do — meant one re-emit anywhere in a five-app chain silently
 * destroyed an upstream warning for every instrument after it.
 *
 * A warning may be raised. It may not be downgraded.
 */
export function sanitizePacket(packet: HthPacket): HthPacket {
  const clean = stripCoordinates(packet) as HthPacket;
  const prior =
    clean.privacy && typeof clean.privacy === "object"
      ? (clean.privacy as PrivacyBlock)
      : undefined;
  clean.privacy = {
    ...(prior ?? {}),
    containsCoordinates: false,
    containsPrivateWater: prior?.containsPrivateWater === true,
  };
  return clean;
}

/* ========================================================================== *
 * One dialect out
 *
 * The fleet shipped two spellings of several ideas — `official_station` beside
 * `official-gauge`, Rig Signal's `falling` beside `frontal_change`, a
 * temperature range as a tuple in one repo and an object in another. Every
 * consumer then had to know all of them, and the ones that did not silently
 * dropped an axis.
 *
 * These run on the way IN and on the way OUT, so a caller of this file only
 * ever sees the canonical spelling and only ever emits it.
 * ========================================================================== */

/** Rewrite one open vocabulary value through its alias table. */
function canonical<T extends string>(value: unknown, aliases: Record<string, T>): T | null {
  const key = str(value);
  if (!key) return null;
  // Own properties only. A bare `aliases[key]` lookup resolves inherited
  // Object.prototype members, so a packet carrying `tempSource: "constructor"`
  // or `evidenceClass: "valueOf"` came back as a Function, was written into the
  // packet as if it were a vocabulary value, survived readPacket() as state
  // "ok", and was interpolated into a note shown to the reader. Nothing in the
  // fleet sends those strings; a malformed or hostile packet does.
  if (!Object.prototype.hasOwnProperty.call(aliases, key)) return null;
  const hit = aliases[key];
  return typeof hit !== "string" || hit === key ? null : hit;
}

/**
 * Normalise the vocabularies that drifted, in place on a copy.
 *
 * `notes` collects a plain sentence per axis actually rewritten, so a repair is
 * reported rather than performed silently — the same rule the legacy envelope
 * repair follows. An already-canonical packet adds no notes and is returned
 * structurally unchanged.
 */
export function normalizeVocabulary(packet: HthPacket, notes: string[] = []): HthPacket {
  const out = packet as HthPacket & Record<string, unknown>;

  const rawConditions = out["conditions"];
  if (isPlainObject(rawConditions)) {
    const conditions: Record<string, unknown> = { ...rawConditions };
    let touched = false;

    for (const field of ["tempSource", "airTempSource"] as const) {
      const fixed = canonical(conditions[field], TEMP_SOURCE_ALIASES);
      if (fixed) {
        notes.push(`Read ${String(conditions[field])} as ${fixed} (the fleet spelling).`);
        conditions[field] = fixed;
        touched = true;
      }
    }

    const weather = canonical(conditions["weather"], WEATHER_TREND_ALIASES);
    if (weather) {
      notes.push(
        `Read the pressure trend ${String(conditions["weather"])} as ${weather} (the fleet spelling).`,
      );
      conditions["weather"] = weather;
      touched = true;
    }

    const range = conditions["tempRangeF"];
    if (range !== undefined && range !== null) {
      const fixed = normalizeTempRangeF(range);
      const already =
        isPlainObject(range) &&
        typeof range["low"] === "number" &&
        typeof range["high"] === "number" &&
        Object.keys(range).length === 2;
      if (fixed && !already) {
        notes.push(
          `Read the temperature range as ${fixed.low}–${fixed.high}°F; it arrived in an older shape.`,
        );
        conditions["tempRangeF"] = fixed;
        touched = true;
      } else if (!fixed) {
        notes.push("Dropped a temperature range that was not a usable pair of numbers.");
        delete conditions["tempRangeF"];
        touched = true;
      }
    }

    if (touched) out["conditions"] = conditions;
  }

  const provenance = out["provenance"];
  if (Array.isArray(provenance)) {
    let touched = false;
    const fixedList = provenance.map((entry) => {
      if (!isPlainObject(entry)) return entry;
      const fixed = canonical(entry["evidenceClass"], EVIDENCE_CLASS_ALIASES);
      if (!fixed) return entry;
      notes.push(
        `Read the evidence class ${String(entry["evidenceClass"])} as ${fixed} (the fleet spelling).`,
      );
      touched = true;
      return { ...entry, evidenceClass: fixed };
    });
    if (touched) out["provenance"] = fixedList;
  }

  return out;
}

/* ========================================================================== *
 * Decoding — both dialects the fleet actually ships
 * ========================================================================== */

/**
 * Decode a fragment body written in either fleet dialect.
 *
 * URI-encoded JSON first, because it is the documented form and the one five of
 * the seven applications write. base64url second, because Hatch Match writes it
 * (`btoa` with `+/=` replaced) and a reader that understood only the first
 * failed on every Hatch Match handoff — silently, which is the part that made
 * it expensive to find.
 *
 * base64url is READ but never WRITTEN. No application that copies this file can
 * become the reason a third dialect spreads.
 */
export function decodePacketBody(raw: string): unknown {
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    /* not URI-encoded JSON — fall through to base64url */
  }
  try {
    let b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    /* `atob` only: it is standard in every browser, in Node 16+, in Bun and in
     * Deno. Reaching for `Buffer` here would drag a Node ambient type into six
     * repos that do not all declare one, and this file takes no dependencies. */
    if (typeof atob !== "function") return undefined;
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

/** Encode for the fragment. Always URI-encoded JSON. See `decodePacketBody`. */
export function encodePacketBody(packet: HthPacket): string {
  return encodeURIComponent(JSON.stringify(packet));
}

/** The full fragment, ready to append to a target URL. */
export function encodePacketHash(packet: HthPacket): string {
  return `#${PACKET_PARAM}=${encodePacketBody(packet)}`;
}

/**
 * Pull the packet body out of whatever the caller had in hand.
 *
 * Accepts a whole URL, a bare fragment, or the fragment's contents, and finds
 * `packet=` wherever it sits among `&`-separated fragment parameters rather
 * than requiring it to be first. Both dialects percent-escape `&` (base64url
 * has no `&` at all), so splitting on `&` can never cut a packet in half.
 * Returns `null` when no packet parameter is present, and `""` when one is
 * present but empty.
 */
function fragmentBody(input: string): string | null {
  const hashAt = input.indexOf("#");
  const fragment = hashAt === -1 ? input : input.slice(hashAt + 1);
  if (!fragment) return null;
  for (const part of fragment.split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) !== PACKET_PARAM) continue;
    return part.slice(eq + 1);
  }
  return null;
}

/* ========================================================================== *
 * Rule 3 and rule 4 — the three-state read, and the version gate
 * ========================================================================== */

/** Why a packet that was offered could not be honoured. Machine-readable
 *  companion to the human `reason`. */
export type PacketInvalidCode =
  "unreadable" | "not-an-object" | "version-mismatch" | "contract-mismatch";

export type PacketRead =
  /** No packet was offered. The ordinary case, and NOT an error. */
  | { state: "absent" }
  /** A packet was offered and could not be honoured. Never silently absent. */
  | { state: "invalid"; code: PacketInvalidCode; reason: string; raw: string }
  /** A packet was offered, gated, stripped and normalised. */
  | {
      state: "ok";
      packet: HthPacket;
      /** Repairs applied to a legacy dialect, in plain sentences. Empty for a
       *  packet that arrived already conforming. Show these; do not hide a
       *  repair from the person relying on the result. */
      normalizations: string[];
    };

/** Guard for the happy path, so callers do not re-derive it. */
export function isPacketOk(read: PacketRead): read is Extract<PacketRead, { state: "ok" }> {
  return read.state === "ok";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Keep only trail entries that are actually a hop. A half-formed entry is
 *  worse than no entry: `packetAge()` would measure from a missing stamp. */
function cleanTrail(value: unknown): TrailEntry[] {
  if (!Array.isArray(value)) return [];
  const out: TrailEntry[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) continue;
    const origin = str(entry["origin"]);
    const at = str(entry["at"]);
    if (origin && at) out.push({ origin, at });
  }
  return out;
}

/**
 * Repair the one legacy envelope this fleet documented, and only that one.
 *
 * Hatch Match ships `{ applicationId: "HTH-HM-001", schemaVersion: "1.2.0" }`
 * with no `packetVersion` and no `fleet` block. It is an HTH-1.0-era sender
 * that predates the envelope, not a stranger, and rejecting it would break a
 * real chain step (Forage/Hatch) that the fleet depends on.
 *
 * So it is lifted into the envelope — explicitly, by an instrument-id pattern
 * this fleet owns, and the repair is REPORTED in `normalizations` rather than
 * performed silently. Anything else missing a version stays rejected: a packet
 * with no declared version is not "probably fine", and half-reading one is how
 * a field with a familiar name and a different meaning gets adopted.
 */
const LEGACY_INSTRUMENT_ID = /^HTH-[A-Z]{2}-\d{3}$/;

function normalizeEnvelope(raw: Record<string, unknown>, notes: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  const legacyId = str(out["applicationId"]);
  const isLegacyStamp =
    !str(out["packetVersion"]) && Boolean(legacyId) && LEGACY_INSTRUMENT_ID.test(legacyId ?? "");

  const rawFleet = out["fleet"];
  const fleet: Record<string, unknown> = isPlainObject(rawFleet) ? { ...rawFleet } : {};
  const trail = cleanTrail(fleet["trail"]);
  /*
   * A sender that declared no `origin` still declared an instrument id, and a
   * trail entry reading "HTH-HM-001" is a worse answer than one reading
   * "hatch-match". Resolving a known id to its fleet name is not rewriting a
   * sender's identity — it is reading the identity it did give us.
   */
  const declaredId = str(out["instrumentId"]) ?? legacyId;
  const origin =
    str(out["origin"]) ??
    (declaredId ? (INSTRUMENT_ORIGIN[declaredId] ?? declaredId) : undefined) ??
    "unknown";
  const createdAt = str(out["createdAt"]);

  if (isLegacyStamp) {
    /*
     * The ONLY envelope repair. It fires on the documented legacy stamp and on
     * nothing else, and it repairs version and contract together — a half
     * repair would leave the packet failing the second gate for a reason that
     * has nothing to do with the sender.
     */
    out["packetVersion"] = PACKET_VERSION;
    if (!str(out["instrumentId"])) out["instrumentId"] = legacyId;
    if (!str(fleet["contract"])) fleet["contract"] = FLEET_CONTRACT;
    const schema = str(out["schemaVersion"]);
    notes.push(
      `Sender stamped this ${schema ? `schemaVersion ${schema}` : "with no schema version"} under applicationId ${legacyId} instead of the fleet envelope. Read as ${PACKET_VERSION} / ${FLEET_CONTRACT}.`,
    );
  }

  /*
   * Seed a trail for a sender that never kept one. Without this the packet
   * arrives ageless, and `assessFreshness()` can only answer "unknown" — the
   * exact failure the Field Ops Desk shipped for months. The seed is the
   * sender's own `createdAt` when it published one, so the age is real rather
   * than reset to now.
   */
  if (!trail.length && createdAt) {
    trail.push({ origin, at: createdAt });
    notes.push(`Sender kept no fleet trail. Seeded one hop from its own createdAt (${origin}).`);
  }
  fleet["trail"] = trail;
  if (!str(fleet["lastUpdatedBy"])) fleet["lastUpdatedBy"] = origin;
  out["fleet"] = fleet;
  if (!str(out["origin"])) out["origin"] = origin;
  return out;
}

/**
 * Read a packet off a URL fragment. NEVER THROWS.
 *
 * `input` may be a whole URL, a fragment, or omitted — omitted reads
 * `location.hash` when there is a browser to read it from, and reports `absent`
 * when there is not (server render, test runner, worker), which is the truth:
 * no packet was offered.
 *
 * Order of operations matters and is fixed:
 *   1. find the fragment parameter          → absent if there is none
 *   2. decode, either dialect               → invalid if neither works
 *   3. normalise the one legacy envelope    → reported, never silent
 *   4. gate the version and the contract    → invalid with a showable reason
 *   5. strip coordinates                    → rule 2, on the way IN
 *
 * Gating before stripping would be cheaper. Stripping last is deliberate: a
 * packet rejected at the gate is handed back only as `raw`, never as a parsed
 * object a caller could be tempted to read fields off.
 */
export function readPacket(input?: string | null): PacketRead {
  let source = input;
  if (source == null) {
    const loc = (globalThis as { location?: { hash?: string } }).location;
    source = typeof loc?.hash === "string" ? loc.hash : "";
  }
  if (!source) return { state: "absent" };

  const raw = fragmentBody(source);
  if (raw === null || raw === "") return { state: "absent" };

  const decoded = decodePacketBody(raw);
  if (decoded === undefined || decoded === null) {
    return {
      state: "invalid",
      code: "unreadable",
      reason:
        "The context attached to this link could not be read. It was probably truncated when the link was copied. Open the previous tool again and follow its handoff link directly.",
      raw,
    };
  }
  if (!isPlainObject(decoded)) {
    return {
      state: "invalid",
      code: "not-an-object",
      reason:
        "The context attached to this link is not a Hook the Horizon packet. Nothing has been carried across.",
      raw,
    };
  }

  const notes: string[] = [];
  const candidate = normalizeEnvelope(decoded, notes);

  const version = str(candidate["packetVersion"]);
  if (version !== PACKET_VERSION) {
    return {
      state: "invalid",
      code: "version-mismatch",
      reason: version
        ? `This link carries a ${version} packet, and this tool reads ${PACKET_VERSION}. Nothing has been carried across — re-open the sending tool and hand off again.`
        : `This link carries context with no declared packet version, and this tool reads ${PACKET_VERSION}. Nothing has been carried across.`,
      raw,
    };
  }

  const fleetBlock = candidate["fleet"];
  const fleet: Record<string, unknown> = isPlainObject(fleetBlock) ? fleetBlock : {};
  const contract = str(fleet["contract"]);
  if (contract !== FLEET_CONTRACT) {
    return {
      state: "invalid",
      code: "contract-mismatch",
      reason: contract
        ? `This link carries a ${contract} fleet contract, and this tool honours ${FLEET_CONTRACT}. Nothing has been carried across.`
        : `This link carries no fleet contract, and this tool honours ${FLEET_CONTRACT}. Nothing has been carried across.`,
      raw,
    };
  }

  /* Rule 2, inbound. Whatever the sender's privacy block claimed — except its
   * private-water warning, which is carried forward rather than re-stated. */
  const stripped = sanitizePacket(candidate as unknown as HthPacket);
  /* One dialect out. Every rewrite is reported in `notes`, never silent. */
  const packet = normalizeVocabulary(stripped, notes);
  return { state: "ok", packet, normalizations: notes };
}

/* ========================================================================== *
 * Age — measured from the trail, not from `createdAt`
 * ========================================================================== */

/** The most recent hop, or null when the packet kept no usable trail. */
export function lastHop(packet: HthPacket): TrailEntry | null {
  const trail = cleanTrail(packet.fleet?.trail);
  return trail.length ? (trail[trail.length - 1] as TrailEntry) : null;
}

/** The first hop — where the context originally entered the fleet. */
export function firstHop(packet: HthPacket): TrailEntry | null {
  const trail = cleanTrail(packet.fleet?.trail);
  return trail.length ? (trail[0] as TrailEntry) : null;
}

function millis(value: unknown): number | null {
  const s = str(value);
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * How old this packet is, in milliseconds. Null when nothing datable travelled.
 *
 * MEASURED FROM THE LAST TRAIL ENTRY, NOT FROM `createdAt`.
 *
 * The Field Ops Desk measured from `packet.createdAt`, and its freshness gate
 * therefore resolved to "no reliable timestamp" for every sender that does not
 * emit that field — Hatch Match emits none at all, and a packet rebuilt by a
 * receiver can carry a `createdAt` that describes the rebuild rather than the
 * hop. `fleet.trail` is the field the contract guarantees, every hop stamps it,
 * and its last entry is by definition the moment this context was last touched
 * by a real instrument.
 *
 * `createdAt` is honoured only as a FALLBACK, for a packet whose trail is
 * missing or malformed. It is never preferred over the trail.
 */
export function packetAge(packet: HthPacket, now: number | Date = Date.now()): number | null {
  const at = millis(lastHop(packet)?.at) ?? millis(packet.createdAt);
  if (at == null) return null;
  const nowMs = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(nowMs)) return null;
  /* Clamped at zero: a sender whose clock runs fast must not make a packet look
   * like it arrives from the future, which would read as "impossibly fresh". */
  return Math.max(0, nowMs - at);
}

/* ========================================================================== *
 * Freshness — ported from field-ops-desk `src/lib/handoff.ts`
 * ========================================================================== */

export type FleetToolKey =
  | "field-sense-navigator"
  | "species-presentation"
  | "hatch-match"
  | "tackle-link-analyst"
  | "rig-signal"
  | "knot-analyst"
  | "field-ops-desk";

/**
 * How long a carried packet may be relied on before it must be re-pulled.
 *
 * The windows are the Field Ops Desk's, unchanged: they encode how fast each
 * instrument's answer actually decays. Water context turns over within the
 * hour (a gauge moves, a closure posts); a species or forage reading holds for
 * a session; a tackle, knot or device answer holds for a day because line and
 * hardware do not change with the weather.
 *
 * `field-ops-desk` is the one addition — the desk emits packets too, and a
 * receiver of one needed a window that the desk's own table did not define.
 */
export const CARRY_WINDOW_MS: Record<FleetToolKey, number> = {
  "field-sense-navigator": 45 * 60_000,
  "species-presentation": 6 * 60 * 60_000,
  "hatch-match": 6 * 60 * 60_000,
  "tackle-link-analyst": 24 * 60 * 60_000,
  "rig-signal": 24 * 60 * 60_000,
  "knot-analyst": 24 * 60 * 60_000,
  "field-ops-desk": 24 * 60 * 60_000,
};

/** Public conditions reads go stale fastest of all. A carried temperature is
 *  older than the packet that carries it. */
export const CONDITIONS_CARRY_WINDOW_MS = 30 * 60_000;

/** The window used when the sender cannot be identified: the shortest one, so
 *  an unknown sender is treated as the most perishable, never the least. */
export const DEFAULT_CARRY_WINDOW_MS = CARRY_WINDOW_MS["field-sense-navigator"];

/**
 * Instrument id → the sender's fleet name.
 *
 * Only needed for a sender that emits an id but no `origin`. Ids not listed
 * here travel unchanged rather than being guessed at.
 */
export const INSTRUMENT_ORIGIN: Record<string, string> = {
  "HTH-HH-001": "field-sense",
  "HTH-SP-001": "species-presentation",
  "HTH-HM-001": "hatch-match",
  "HTH-RS-001": "rig-signal",
  /* Registered from what these three actually emit, not from a guess: Tackle
   * Link's `FLEET_INSTRUMENT_ID`, the id Knot Analyst stamps on its outbound
   * packet, and the Field Ops Desk's `OPS_INSTRUMENT_ID`. Until they were
   * listed here, a sender that emitted its id without an `origin` had the raw
   * id written into the trail, where the next reader saw "HTH-TL-001" instead
   * of a fleet name. */
  "HTH-TL-001": "tackle-link-analyst",
  "HTH-KN-001": "knot-analyst",
  /* Knot Analyst's older engine-provenance stamp, which the Field Ops Desk's
   * own tool registry still lists as that instrument's id. Same instrument. */
  "HTH-KK-001": "knot-analyst",
  /* Three letters, not two — the desk's id predates the two-letter pattern. */
  "HTH-OPS-001": "field-ops-desk",
};

/**
 * Sender name → tool key.
 *
 * Both of Field Ops' own spellings are here because it emits `origin:
 * "field-ops"` from one code path and `"field-ops-desk"` from another. The
 * instrument ids are here because Hatch Match emits no `origin` at all, so its
 * `applicationId` is the only identity that arrives.
 */
export const ORIGIN_TO_TOOL: Record<string, FleetToolKey> = {
  "field-sense": "field-sense-navigator",
  "field-sense-navigator": "field-sense-navigator",
  "HTH-HH-001": "field-sense-navigator",
  "species-presentation": "species-presentation",
  "species-presentation-analyst": "species-presentation",
  "HTH-SP-001": "species-presentation",
  "hatch-match": "hatch-match",
  "HTH-HM-001": "hatch-match",
  "tackle-link": "tackle-link-analyst",
  "tackle-link-analyst": "tackle-link-analyst",
  "HTH-TL-001": "tackle-link-analyst",
  "knot-analyst": "knot-analyst",
  "HTH-KN-001": "knot-analyst",
  "HTH-KK-001": "knot-analyst",
  "rig-signal": "rig-signal",
  "HTH-RS-001": "rig-signal",
  "field-ops": "field-ops-desk",
  "field-ops-desk": "field-ops-desk",
  "HTH-OPS-001": "field-ops-desk",
};

/** Which tool last touched this packet, when it can be told. */
export function toolKeyOf(packet: HthPacket): FleetToolKey | null {
  const candidates = [
    lastHop(packet)?.origin,
    packet.fleet?.lastUpdatedBy,
    packet.origin,
    packet.instrumentId,
  ];
  for (const candidate of candidates) {
    const key = str(candidate);
    if (key && ORIGIN_TO_TOOL[key]) return ORIGIN_TO_TOOL[key] as FleetToolKey;
  }
  return null;
}

export type FreshnessAssessment = {
  /** The desk's gate vocabulary, so this drops straight into a gate list.
   *  GATE ON THIS FIELD. See `expired` below for why it is not the one. */
  severity: "blocked" | "caution" | "clear";
  /** False when nothing datable travelled. Fails toward caution, never clear:
   *  the desk cannot grade what it has not measured. */
  measured: boolean;
  ageMs: number | null;
  windowMs: number;
  /**
   * DO NOT GATE ON THIS. Gate on `state`/`severity`, or on `measured`.
   *
   * `expired` answers one question only: did a measured age run past its
   * window? A packet that carried no usable timestamp is not expired — there
   * was nothing to expire — so this is `false` alongside `measured: false` and
   * `severity: "caution"`. That combination is correct and it is also a trap:
   * `expired` is the obvious field to reach for, and an ageless packet read
   * through it alone looks fresh. It is only meaningful when `measured` is
   * true. `severity` already folds both cases in, which is why it is the field
   * to branch on.
   */
  expired: boolean;
  label: string;
  detail: string;
};

/**
 * Grade a carried packet's age against its sender's window.
 *
 * Ported from `assessCarry()` in field-ops-desk, keeping its three bands and
 * its wording: past the window is BLOCKED, past 70% of it is CAUTION, and an
 * unmeasurable age is CAUTION rather than clear. The route, conflict and
 * contradiction gates stay in the desk — they depend on that application's own
 * probe results and have no meaning in the other six.
 */
export function assessFreshness(
  packet: HthPacket,
  options: { toolKey?: Opt<FleetToolKey>; windowMs?: Opt<number>; now?: Opt<number | Date> } = {},
): FreshnessAssessment {
  const now = options.now ?? Date.now();
  const toolKey = options.toolKey ?? toolKeyOf(packet);
  const windowMs =
    options.windowMs ?? (toolKey ? CARRY_WINDOW_MS[toolKey] : DEFAULT_CARRY_WINDOW_MS);
  const ageMs = packetAge(packet, now);
  const minutes = (ms: number) => Math.round(ms / 60_000);
  /* "1 minute", not "1 minute(s)". This string is shown to a person in every
   * repo that renders the detail line, and a parenthesised plural is a log
   * line, not something anyone writes on purpose. */
  const minutesAgo = (ms: number) => {
    const m = Math.max(1, minutes(ms));
    return `${m} ${m === 1 ? "minute" : "minutes"}`;
  };
  const from = str(lastHop(packet)?.origin) ?? str(packet.origin) ?? "the sending tool";

  if (ageMs == null) {
    return {
      severity: "caution",
      measured: false,
      ageMs: null,
      windowMs,
      expired: false,
      label: "Freshness",
      detail: `This context carries no usable timestamp, so its age cannot be graded. Check ${from} again before relying on it.`,
    };
  }

  const expired = ageMs > windowMs;
  if (expired) {
    return {
      severity: "blocked",
      measured: true,
      ageMs,
      windowMs,
      expired: true,
      label: "Freshness",
      detail: `This context was carried ${minutesAgo(ageMs)} ago, past its ${minutes(windowMs)}-minute window. Check again from ${from} before you rely on it.`,
    };
  }
  if (ageMs > windowMs * 0.7) {
    return {
      severity: "caution",
      measured: true,
      ageMs,
      windowMs,
      expired: false,
      label: "Freshness",
      detail: `Carried ${minutesAgo(ageMs)} ago, near the end of its ${minutes(windowMs)}-minute window. Re-pull if the day has changed.`,
    };
  }
  return {
    severity: "clear",
    measured: true,
    ageMs,
    windowMs,
    expired: false,
    label: "Freshness",
    detail: `Carried ${minutesAgo(ageMs)} ago, inside its ${minutes(windowMs)}-minute window.`,
  };
}

/* ========================================================================== *
 * The fleet
 * ========================================================================== */

export type FleetTargetKey = "water" | "species" | "hatch" | "tackle" | "knot" | "ops" | "rig";

export type FleetTarget = {
  key: FleetTargetKey;
  /** The instrument's name in the fleet. */
  name: string;
  short: string;
  url: string;
  toolKey: FleetToolKey;
  /** `chain` steps run in order; `sidecar` may be entered from and returned to
   *  any step, and nothing downstream may require it. */
  role: "chain" | "sidecar";
  /** The step's name in the workflow. */
  step: string;
  /** The question this instrument answers. */
  question: string;
};

/**
 * Every address in the fleet, in one place.
 *
 * Copied into seven repositories, so a moved instrument is one edit repeated
 * seven times rather than a hunt through seven different hard-coded lists.
 * URLs carry no trailing slash; `packetUrl()` handles joining.
 */
export const FLEET_TARGETS: Record<FleetTargetKey, FleetTarget> = {
  water: {
    key: "water",
    name: "Field Sense Navigator",
    short: "Field Sense",
    url: "https://waterways.hookthehorizon.blog",
    toolKey: "field-sense-navigator",
    role: "chain",
    step: "Water",
    question: "Which water, what kind of water is it, and what still has to be checked today?",
  },
  species: {
    key: "species",
    name: "Species & Presentation",
    short: "Species",
    url: "https://species.hookthehorizon.blog",
    toolKey: "species-presentation",
    role: "chain",
    step: "Species & presentation",
    question:
      "Which fish are worth planning around here, how do they behave, and what presentation follows?",
  },
  hatch: {
    key: "hatch",
    name: "Hatch Match",
    short: "Hatch Match",
    url: "https://hatch.hookthehorizon.blog",
    toolKey: "hatch-match",
    role: "chain",
    step: "Forage & hatch",
    question: "What are they likely eating on this kind of water at this time of year?",
  },
  tackle: {
    key: "tackle",
    name: "Tackle Link Analyst",
    short: "Tackle Link",
    url: "https://tackle.hookthehorizon.blog",
    toolKey: "tackle-link-analyst",
    role: "chain",
    step: "Tackle",
    question: "Does my line, leader and terminal tackle survive this water?",
  },
  knot: {
    key: "knot",
    name: "Knot Analyst",
    short: "Knot",
    url: "https://knot.hookthehorizon.blog",
    toolKey: "knot-analyst",
    role: "chain",
    step: "Knot",
    question: "Which connection holds for this line class and this structure?",
  },
  ops: {
    key: "ops",
    name: "Field Ops Desk",
    short: "Field Ops",
    url: "https://ops.hookthehorizon.blog",
    toolKey: "field-ops-desk",
    role: "chain",
    step: "Field ops & debrief",
    question:
      "How does this become a trip — travel, timing, kit, the open checks, and the debrief?",
  },
  rig: {
    key: "rig",
    name: "Rig Signal",
    short: "Rig Signal",
    url: "https://rig-signal.hookthehorizon.blog",
    toolKey: "rig-signal",
    role: "sidecar",
    step: "Optional · device validation",
    question: "Do the electronics or device claims hold under the conditions you actually stated?",
  },
};

/**
 * The chain, in order.
 *
 * Water → Species → Forage/Hatch → Presentation → Tackle → Knot → Field Ops →
 * Debrief. Presentation has no application of its own — Species &
 * Presentation owns it, which is why it is one stop here and not two. Debrief
 * is the closing step of Field Ops rather than an eighth address.
 *
 * Rig Signal is deliberately absent: it is a sidecar, and putting it in this
 * array is how it would quietly become a required step.
 */
export const CHAIN_ORDER: readonly FleetTargetKey[] = [
  "water",
  "species",
  "hatch",
  "tackle",
  "knot",
  "ops",
] as const;

/** The next chain step after this one, or null at the end of the chain. */
export function nextInChain(key: FleetTargetKey): FleetTargetKey | null {
  const at = CHAIN_ORDER.indexOf(key);
  if (at === -1) return null; // a sidecar has no position, by design
  return (CHAIN_ORDER[at + 1] as FleetTargetKey | undefined) ?? null;
}

/* ========================================================================== *
 * Rule 1 — emitting, with the trail extended rather than restarted
 * ========================================================================== */

export type BuildPacketInput = {
  /** This instrument's own name for itself, e.g. "field-sense". */
  origin: string;
  /** This instrument's fleet id, e.g. "HTH-HH-001". */
  instrumentId?: Opt<string>;
  /** Which step this packet is meant for. Advisory only. */
  intent?: Opt<FleetTargetKey | string>;
  /**
   * The packet that arrived, if one did. Accepts a `readPacket()` result
   * directly so a caller cannot accidentally pass an unvalidated packet: an
   * `absent` or `invalid` read contributes nothing and starts a fresh chain.
   */
  incoming?: Opt<HthPacket | PacketRead>;
  water?: Opt<Partial<WaterBlock>>;
  reading?: Opt<Partial<ReadingBlock>>;
  logistics?: Opt<Partial<LogisticsBlock>>;
  /** `tempRangeF` may be given in any accepted shape; it is emitted as
   *  `{ low, high }`. Everything else is the canonical block. */
  conditions?: Opt<ConditionsInput>;
  job?: Opt<JobRef>;
  readiness?: Opt<ReadinessBlock>;
  /** Replaces the incoming list when given, because open checks belong to the
   *  instrument that owns the record. Carried forward untouched when omitted. */
  openChecks?: Opt<string[]>;
  /** Appended to whatever arrived. Provenance accumulates; it never resets. */
  provenance?: Opt<ProvenanceEntry[]>;
  /** Instrument-specific blocks — `claimEvaluation`, `tackleEvaluation`,
   *  `knotDecision`, `hypotheses`, and anything a future instrument adds. */
  blocks?: Opt<Record<string, unknown>>;
  /**
   * This instrument's own privacy claim.
   *
   * `containsCoordinates` is not taken from here — this file strips coordinates
   * and states that one itself. `containsPrivateWater` IS: it is a claim only
   * the sender can make, and it is OR-ed with whatever arrived. An instrument
   * can raise the warning. Nothing can lower it.
   */
  privacy?: Opt<Partial<PrivacyBlock>>;
  /** Injectable clock, so a test can assert on a stamp. */
  now?: Opt<Date | string>;
};

/**
 * Accept either a packet or a `readPacket()` result.
 *
 * Narrowed by hand rather than by `"state" in value`, because `HthPacket`
 * carries an index signature and so structurally admits a `state` key of its
 * own — the compiler cannot tell the two apart, and a wrong guess here would
 * silently drop an incoming chain.
 */
function incomingPacketOf(value: Opt<HthPacket | PacketRead>): HthPacket | null {
  if (!value) return null;
  const read = value as { state?: unknown; packet?: unknown };
  if (read.state === "ok" && isPlainObject(read.packet)) return read.packet as HthPacket;
  if (read.state === "absent" || read.state === "invalid") return null;
  return value as HthPacket;
}

function mergeBlock(base: unknown, patch: unknown): Record<string, unknown> | undefined {
  const a = isPlainObject(base) ? base : undefined;
  const b = isPlainObject(patch) ? patch : undefined;
  if (!a && !b) return undefined;
  return { ...(a ?? {}), ...(b ?? {}) };
}

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Build an outgoing packet.
 *
 * THE INCOMING PACKET IS EXTENDED, NOT REPLACED. Every block merges over what
 * arrived rather than overwriting it, unknown blocks travel untouched, and
 * `fleet.trail` gains exactly one entry. An instrument adds what it knows to a
 * chain; it does not restart one.
 *
 * A note for callers who rebuild on every render: build from the ORIGINAL
 * incoming packet each time, never from your own previous output. Feeding this
 * function its own result repeatedly is the one way to grow a trail without
 * bound, and the signature is shaped to make the right thing the easy thing.
 *
 * Coordinates are stripped on the way out as well as on the way in — the
 * outbound strip is what stops this instrument leaking a coordinate it invented
 * itself, which no amount of care by the receiver could catch.
 */
export function buildPacket(input: BuildPacketInput): HthPacket {
  const nowIso =
    input.now instanceof Date
      ? input.now.toISOString()
      : (str(input.now) ?? new Date().toISOString());

  const incoming = incomingPacketOf(input.incoming);
  const base: Record<string, unknown> = incoming
    ? { ...(incoming as Record<string, unknown>) }
    : {};

  /* Rule 1. `cleanTrail` drops half-formed entries so a later `packetAge()`
   * cannot read a hop with no stamp; everything well-formed is kept, in order. */
  const basePrivacy: Record<string, unknown> = isPlainObject(base["privacy"])
    ? base["privacy"]
    : {};
  const ownPrivacy: Record<string, unknown> = isPlainObject(input.privacy) ? input.privacy : {};

  const baseFleetRaw = base["fleet"];
  const baseFleet: Record<string, unknown> = isPlainObject(baseFleetRaw) ? baseFleetRaw : {};
  const trail: TrailEntry[] = [
    ...cleanTrail(baseFleet["trail"]),
    { origin: input.origin, at: nowIso },
  ];

  const out: Record<string, unknown> = {
    ...base,
    packetVersion: PACKET_VERSION,
    origin: input.origin,
    createdAt: nowIso,
    fleet: {
      ...baseFleet,
      contract: FLEET_CONTRACT,
      trail,
      lastUpdatedBy: input.origin,
    },
    /* Provenance accumulates across the whole chain: the last reader must be
     * able to see where every number came from, not only the last hop's. */
    provenance: [
      ...arrayOf<ProvenanceEntry>(base["provenance"]),
      ...arrayOf<ProvenanceEntry>(input.provenance),
    ],
    /*
     * A private-water warning is OR-ed forward, never re-stated.
     *
     * This block used to be written flat, AFTER `...base`, which meant an
     * instrument re-emitting somebody else's packet erased an upstream
     * `containsPrivateWater: true` for every instrument after it. The contract
     * calls privacy the sender's claim; that let one sender delete another's.
     *
     * `containsCoordinates` is different and may be re-asserted, because
     * `sanitizePacket()` below has actually removed the coordinates and can say
     * so. A claim this file can prove, it makes. A warning it cannot check, it
     * carries.
     */
    privacy: {
      ...basePrivacy,
      ...ownPrivacy,
      containsCoordinates: false,
      containsPrivateWater:
        basePrivacy["containsPrivateWater"] === true || ownPrivacy["containsPrivateWater"] === true,
    },
  };

  const instrumentId = str(input.instrumentId) ?? str(base["instrumentId"]);
  if (instrumentId) out["instrumentId"] = instrumentId;
  const intent = str(input.intent);
  if (intent) out["intent"] = intent;

  const water = mergeBlock(base["water"], input.water);
  if (water) out["water"] = water;
  const reading = mergeBlock(base["reading"], input.reading);
  if (reading) out["reading"] = reading;
  const logistics = mergeBlock(base["logistics"], input.logistics);
  if (logistics) out["logistics"] = logistics;
  const conditions = mergeBlock(base["conditions"], input.conditions);
  if (conditions) out["conditions"] = conditions;

  if (input.job !== undefined) out["job"] = input.job;
  if (input.readiness !== undefined) out["readiness"] = input.readiness;
  if (input.openChecks !== undefined && input.openChecks !== null) {
    out["openChecks"] = [...input.openChecks];
  }

  /* Instrument-specific blocks last, so an instrument can always state its own
   * result even where an upstream packet used the same key for something else. */
  if (isPlainObject(input.blocks)) {
    for (const [key, value] of Object.entries(input.blocks)) out[key] = value;
  }

  /* Rule 2, outbound, and one dialect out: an instrument that copies this file
   * cannot become the reason a second spelling of `official-station` or a
   * second shape of `tempRangeF` keeps circulating. */
  return normalizeVocabulary(sanitizePacket(out as unknown as HthPacket));
}

/**
 * A pressable link into another instrument, context attached.
 *
 * `target` is a fleet key or a bare base URL, so an application can link to a
 * specific route (`.../debrief`) without leaving the registry. The packet
 * always travels in the FRAGMENT: a fragment is never sent to a server, and
 * this packet describes where a person intends to go fishing.
 */
export function packetUrl(target: FleetTargetKey | string, packet: HthPacket): string {
  const known = (FLEET_TARGETS as Record<string, FleetTarget | undefined>)[target];
  const base = (known?.url ?? target).replace(/\/+$/, "");
  /* `https://host/#packet=` rather than `https://host#packet=`. Both resolve to
   * the same page, but a link checker normalises the first form into the
   * second, so two copies of one handoff stop comparing equal. The slash is
   * added only where the address is a bare host: a target that already names a
   * route (`.../debrief`) keeps the path it was given. */
  const root = /^https?:\/\/[^/]+$/.test(base) ? `${base}/` : base;
  return `${root}${encodePacketHash(sanitizePacket(packet))}`;
}
