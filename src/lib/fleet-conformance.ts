/**
 * Fleet conformance fixtures — what the other six instruments actually send.
 *
 * Every instrument in this fleet tests its own half of a handoff. Nothing
 * tested the join, and the join is where the failures live. Two found in one
 * afternoon make the case better than any argument:
 *
 *   · Tackle Link's inbound reader could not read the fleet's own canonical
 *     forage words. Its patterns were written for loose prose, so
 *     `small_forage_fish` — the one spelling every instrument is supposed to
 *     send — matched nothing and was dropped in silence. Its own tests passed
 *     throughout, because they fed it the prose it was written for.
 *
 *   · Hatch Match refused every saltwater packet at the door with a polite
 *     note, which was true when it was written and had quietly become the
 *     reason a whole coast of the fleet could not talk to it.
 *
 * Neither is a bug in one instrument. Both are a bug in the space between two,
 * and that space had no owner. This file is the owner.
 *
 * It holds one realistic packet per emitting instrument, written from that
 * instrument's real emitter rather than from what a receiver wishes it sent.
 * It is byte-identical in all seven repositories, exactly like `hth-packet.ts`,
 * and for the same reason: a shared contract tested against seven different
 * ideas of what the contract says is not a shared contract.
 *
 * DELIBERATELY DEPENDENCY-FREE. It imports nothing — not even the packet types
 * it describes — because it has to compile and run identically under vitest,
 * under bun test and under `node --test` with a type-stripping loader, in
 * repositories that disagree about import extensions and path aliases. The
 * receiving test casts it to whatever that repository calls a packet.
 *
 * WHEN AN EMITTER CHANGES ITS SHAPE, CHANGE THE SAMPLE HERE, in every repo.
 * A sample that has drifted from its emitter is worse than no sample: it is a
 * test that passes while the fleet is broken.
 *
 * That is not hypothetical. The first draft of this file was written from what
 * receivers expected rather than from the emitters themselves, and checking it
 * against the real emitters found four more joins broken:
 *
 *   · Species & Presentation put an English sentence in `connectionRequirements
 *     .job` — a field the contract reserves for a connection-job id. Knot
 *     Analyst checked the sentence against its list of jobs, matched nothing,
 *     and declined the whole handoff. The one instrument built to answer
 *     "which connection" started from zero on every reading Species sent it.
 *
 *   · Species states a retie frequency for every family it ranks, on a scale
 *     (`high`/`moderate`/`low`). Knot Analyst has a retie axis, on events
 *     (`frequent`/`occasional`/`rare`), and a `retie` search param wired to it.
 *     Nothing translated, so nothing arrived.
 *
 *   · Tackle Link emits both line diameters as measurements. Knot Analyst
 *     reasons in relational bands and has the arithmetic to convert. Nobody
 *     had connected the two, so it asked the angler for a relation the fleet
 *     had already measured.
 *
 *   · Rig Signal emits `connectionRequirements` only when a joint is in focus.
 *     Hand off the whole arrangement and the materials are still declared —
 *     one level down, on `rigArchitecture` — and Knot Analyst walked past them
 *     and then asked which lines were being joined.
 *
 * Every one of those is invisible from inside a single repository.
 */

export type FleetSampleCarries =
  | "water"
  | "marine-water"
  | "conditions"
  | "temperature"
  | "species"
  | "forage"
  | "presentation"
  | "tackle"
  | "connection"
  | "rig"
  | "trip";

export interface FleetSample {
  /** Stable id, used in test names so a failure says which join broke. */
  id: string;
  /** The `origin` the packet carries — the sender's own name for itself. */
  from: string;
  /** Human label for a failure message. */
  label: string;
  /** What a receiver should be able to take from this packet, if it models it. */
  carries: FleetSampleCarries[];
  /** One line on why this sample exists at all. */
  note: string;
  /** The packet, as that instrument really builds it. */
  packet: Record<string, unknown>;
}

const AT = "2026-09-04T12:00:00.000Z";

function envelope(origin: string, instrumentId: string, intent: string) {
  return {
    packetVersion: "HTH-1.0",
    origin,
    intent,
    createdAt: AT,
    instrumentId,
    fleet: {
      contract: "HTH-FLEET-1.0",
      trail: [{ origin, at: AT }],
      lastUpdatedBy: origin,
    },
  };
}

export const FLEET_SAMPLES: FleetSample[] = [
  /* ---------------------------------------------------------------- */
  {
    id: "field-sense-river",
    from: "field-sense",
    label: "Field Sense Navigator — a named river",
    carries: ["water", "conditions", "temperature", "species"],
    note: "The canonical emitter. Every other packet shape in the fleet is derived from this one.",
    packet: {
      ...envelope("field-sense", "HTH-HH-001", "hatch"),
      water: {
        waterId: "mo-current-river",
        waterName: "Current River",
        waterType: "flowing",
        waterClass: "river",
        region: "Ozarks",
        state: "Missouri",
        documentedSpecies: ["Rainbow trout", "Brown trout", "Smallmouth bass"],
        selectedSpecies: "Smallmouth bass",
        managingAgency: "Missouri Department of Conservation",
        officialSourceUrl: "https://mdc.mo.gov/",
      },
      reading: {
        waterClass: "river",
        headline: "Moving water. The read is about current first and depth second.",
        cues: [
          { family: "current", title: "Seams where fast water meets slow" },
          { family: "depth", title: "The tail of a riffle before it drops" },
        ],
        shaped: ["Gravel and cobble through the documented reach"],
      },
      logistics: { namedSites: 4, trailerLaunch: false, handLaunch: true, shoreAccess: true },
      /*
       * Field Sense is the only instrument that ORIGINATES a job, and what it
       * means by the word is an access mode — how you are getting on the water.
       * The `kind` says so rather than leaving the next reader to infer it from
       * the id, which is what every reader was doing.
       */
      job: { id: "bank", label: "Bank & shoreline", kind: "access" },
      /* Emitted on every handoff, in this instrument's own band words. A
         receiver that hard-codes a band vocabulary will break here. */
      readiness: { score: 74, band: "Plan with checks" },
      openChecks: [
        "No gauge within the documented reach — the flow class is from the nearest upstream station",
      ],
      conditions: {
        waterType: "flowing",
        tempF: 58,
        tempUnit: "F",
        tempSource: "official-station",
        tempObservedAt: AT,
        flow: "moderate",
        clarity: "clear",
        light: "low_light",
        weather: "stable",
        season: "early_summer",
      },
      provenance: [
        {
          source: "USGS gauge 07067000",
          evidenceClass: "official-station",
          reviewedAt: "2026-09-03",
          builtAt: AT,
        },
      ],
      privacy: { containsCoordinates: false, containsPrivateWater: false },
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: "field-sense-surf",
    from: "field-sense",
    label: "Field Sense Navigator — a surf mark",
    carries: ["marine-water", "conditions", "temperature"],
    note: "The shape Hatch Match refused at the door until its salt wave. Marine water types are the fleet's own four words, not a synonym.",
    packet: {
      ...envelope("field-sense", "HTH-HH-001", "hatch"),
      water: {
        waterName: "Nauset Beach",
        waterType: "surf",
        waterClass: "surf",
        region: "Cape Cod",
        state: "Massachusetts",
        documentedSpecies: ["Striped bass", "Bluefish"],
      },
      reading: {
        waterClass: "surf",
        headline: "Open beach. The read is about the bar and the cut through it.",
        cues: [{ family: "structure", title: "The gap in the outer bar" }],
      },
      conditions: {
        waterType: "surf",
        tempF: 61,
        tempUnit: "F",
        tempSource: "official-station",
        tempObservedAt: AT,
        tideMovement: "flooding",
        tideStrength: "spring_tide",
        clarity: "lightly_stained",
        light: "low_light",
        weather: "building",
        season: "late_summer",
      },
      privacy: { containsCoordinates: false, containsPrivateWater: false },
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: "species-flowing",
    from: "species-presentation",
    label: "Species & Presentation — a river reading",
    carries: ["water", "conditions", "species", "presentation", "connection"],
    note: "Carries the presentation job mechanically as well as by name, which is what lets Rig Signal arrange it instead of guessing from a family id.",
    packet: {
      ...envelope("species-presentation", "HTH-SP-001", "rig"),
      water: { waterType: "flowing", waterClass: "river", selectedSpecies: "Smallmouth bass" },
      conditions: { waterType: "flowing", tempF: 62, season: "summer", flow: "moderate" },
      species: {
        id: "micropterus_dolomieu",
        scientificName: "Micropterus dolomieu",
        commonNames: ["Smallmouth bass"],
        targetStatus: "standard",
      },
      hypotheses: {
        thermalState: "optimal",
        positioning: ["Holding on the current break below the riffle"],
        why: ["Water is inside the reviewed optimal band"],
        invalidators: ["A cold front dropping the water four degrees overnight"],
      },
      presentationRequirements: {
        families: ["bottom_contact_drift", "cross_current_retrieve"],
        mechanics: ["Occasional contact", "Drift with the current, not across it"],
        /*
         * Copied field-for-field off `PRESENTATION_MOTION.bottom_contact_drift`
         * and `leadingMotion()`. Three things here were wrong when this sample
         * was first written from memory: the key is `shape`, not `path`; a
         * family that works a band declares `depth` as an ARRAY; and the strike
         * window vocabulary is `medium`, not `moderate`. All three were
         * plausible, all three were fiction, and a receiver tested only against
         * the fiction is not tested.
         */
        motion: {
          family: "bottom_contact_drift",
          depth: ["near-bottom", "bottom"],
          shape: "drift",
          speed: "slow",
          pause: "none",
          contact: "occasional",
          strikeWindow: "short",
          current: "with",
        },
        weightedFamilies: [
          { id: "bottom_contact_drift", weight: 44 },
          { id: "cross_current_retrieve", weight: 31 },
        ],
      },
      equipmentRequirements: {
        depthControl: "high",
        sensitivity: "high",
        castingDistance: "short_to_moderate",
        coverResistance: "moderate",
        lineVisibilityPreference: "low",
        retieFrequency: "high",
      },
      /*
       * The real emitter. `job` is null on purpose and `intent` carries the
       * sentence, because this instrument cannot honestly name a connection
       * job without knowing what is on the spool. Before this shape existed
       * the sentence sat in `job`, Knot Analyst checked it against its list of
       * connection jobs, matched nothing, and declined the entire handoff.
       */
      connectionRequirements: {
        intent:
          "Match line to leader so the presentation can do the mechanical job without advertising hardware.",
        job: null,
        jobUndeclared:
          "The joint that matters here is the main line to the leader. Whether that is a braid-to-leader join or a line-to-line join depends on what is on the spool, which this reading does not establish — Tackle Link does.",
        retieFrequency: "frequent",
        priorities: [
          "compact passage through guides",
          "repeatable field retie",
          "moderate field constraint",
          "low-visibility terminal",
        ],
      },
      unknowns: ["No clarity was declared, which changes how close the fish will let you work"],
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: "species-inshore",
    from: "species-presentation",
    label: "Species & Presentation — an inshore reading",
    carries: ["marine-water", "species", "presentation"],
    note: "The salt half of the same emitter. A receiver that handles the river sample and drops this one has a freshwater assumption in it somewhere.",
    packet: {
      ...envelope("species-presentation", "HTH-SP-001", "rig"),
      water: { waterType: "inshore", waterClass: "inshore", selectedSpecies: "Striped bass" },
      conditions: {
        waterType: "inshore",
        tempF: 60,
        season: "late_summer",
        tideMovement: "ebbing",
      },
      species: {
        id: "morone_saxatilis",
        scientificName: "Morone saxatilis",
        commonNames: ["Striped bass"],
        targetStatus: "standard",
      },
      hypotheses: { thermalState: "optimal", positioning: ["On the down-tide edge of the bar"] },
      presentationRequirements: {
        families: ["subsurface_slow_roll", "stop_and_go"],
        motion: {
          family: "subsurface_slow_roll",
          depth: ["upper", "mid"],
          shape: "retrieve",
          speed: "slow",
          pause: "none",
          contact: "none",
          strikeWindow: "medium",
          current: "none",
        },
      },
      connectionRequirements: {
        intent:
          "Match line to leader so the presentation can do the mechanical job without advertising hardware.",
        job: null,
        jobUndeclared:
          "The joint that matters here is the main line to the leader. Whether that is a braid-to-leader join or a line-to-line join depends on what is on the spool, which this reading does not establish — Tackle Link does.",
        retieFrequency: "occasional",
        priorities: ["compact passage through guides", "repeatable field retie"],
      },
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: "hatch-insect",
    from: "hatch-match",
    label: "Hatch Match — a freshwater observation",
    carries: ["water", "forage"],
    note: "An identification, not a hatch. The class is the fleet's word; the cues are what the person actually saw.",
    packet: {
      ...envelope("hatch-match", "HTH-HM-001", "species"),
      water: { waterType: "flowing", waterClass: "river" },
      conditions: { waterType: "flowing" },
      forage: {
        class: "emerging_insects",
        group: "Mayfly",
        confidence: "moderate",
        sizeBand: "medium",
        cues: [
          { family: "structure", title: "Three tail filaments clearly visible" },
          { family: "structure", title: "Wings held upright (sailboat posture)" },
        ],
      },
      provenance: [
        { source: "Maine Department of Environmental Protection", evidenceClass: "declared" },
      ],
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: "hatch-marine",
    from: "hatch-match",
    label: "Hatch Match — a marine observation",
    carries: ["marine-water", "forage"],
    note: "Impossible before the salt wave. `cephalopods` is the fleet's twelfth forage class and exists because this observation had nowhere to go.",
    packet: {
      ...envelope("hatch-match", "HTH-HM-001", "species"),
      water: { waterType: "inshore", waterClass: "inshore" },
      conditions: { waterType: "inshore" },
      forage: {
        class: "cephalopods",
        group: "Inshore squid",
        confidence: "moderate",
        sizeBand: "outsized",
        cues: [
          { family: "structure", title: "Eight arms plus two longer tentacles" },
          { family: "structure", title: "Fins along a torpedo-shaped mantle" },
        ],
      },
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: "tackle-evaluation",
    from: "tackle-link",
    label: "Tackle Link Analyst — a system evaluation",
    carries: ["water", "forage", "tackle", "connection", "presentation"],
    note: "Its outbound forage now speaks the fleet's vocabulary and keeps its own finer word alongside, rather than posting only its own ids.",
    packet: {
      ...envelope("tackle-link", "HTH-TL-001", "rig"),
      water: { waterType: "surf", waterClass: "surf" },
      conditions: { waterType: "surf", tideMovement: "flooding" },
      /*
       * No top-level `job`. Tackle Link does not originate one — it reads the
       * access job an upstream instrument declared and puts its own fishing job
       * inside `tackleEvaluation`, where the name cannot be mistaken for the
       * access mode. The first draft of this sample invented a top-level job
       * here, which would have taught a receiver to expect a field that never
       * arrives.
       */
      tackleEvaluation: {
        job: { id: "surf-bait", label: "Anchored bait in the surf" },
        verdict: "workable",
        weakestLink: "leader",
        note: "The leader is the first thing that gives, which is the right place for it to give.",
      },
      equipmentRequirements: { rodPower: "heavy", lineClassLb: 20 },
      /*
       * Tackle Link's real block. Note what is NOT here: a connection job and a
       * diameter relation. It emits `terminationMethod` — the knot currently
       * tied, which is a different question — and it emits both diameters as
       * measurements. A receiver that wants a relational band has to work it
       * out from the two numbers, and until this sample was corrected nobody
       * had noticed that no instrument in the fleet emits a band at all.
       */
      connectionRequirements: {
        terminationMethod: "improved clinch",
        mainMaterial: "braid",
        mainConstruction: "8-strand",
        mainStrengthLb: 30,
        mainDiameterIn: 0.011,
        mainMeasuredBreakLb: 26,
        mainCondition: "used",
        secondaryMaterial: "mono",
        secondaryConstruction: "single-strand",
        secondaryStrengthLb: 40,
        secondaryDiameterIn: 0.024,
        mustPassGuides: true,
      },
      presentationRequirements: { type: "bait", weightOz: 4, resistance: "high" },
      observations: { forage: { class: "small_forage_fish", local: "baitfish", size: "medium" } },
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: "rig-architecture",
    from: "rig-signal",
    label: "Rig Signal — an arrangement",
    carries: ["marine-water", "rig", "connection"],
    note: "Names the connection job for each joint rather than leaving a receiver to infer it from the materials, which is exactly the inference that goes wrong.",
    packet: {
      ...envelope("rig-signal", "HTH-RS-001", "knot"),
      water: { waterType: "surf", waterClass: "surf" },
      conditions: { waterType: "surf" },
      /*
       * Rig Signal emits this block only when a joint is in focus, and its key
       * is `connectionJob`. Hand off the whole arrangement with nothing in
       * focus and the block is absent entirely — the second sample below is
       * that case, and it is the one that used to arrive at Knot Analyst
       * carrying nothing.
       */
      connectionRequirements: {
        connectionJob: "braid-to-leader",
        mainMaterial: "braid",
        secondaryMaterial: "mono",
        mustPassGuides: true,
        note: "From a High-low dropper: Main line to the rig body.",
      },
      rigArchitecture: {
        id: "high-low-dropper",
        name: "High-low dropper",
        water: "surf",
        mainMaterial: "braid",
        leaderMaterial: "mono",
        connections: [
          { id: "c-main", where: "Main line to the rig body", job: "braid-to-leader" },
          { id: "c-drop-upper", where: "Upper dropper", job: "mid-line-loop" },
          { id: "c-sinker", where: "Sinker", job: "line-to-swivel" },
        ],
      },
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: "rig-whole-arrangement",
    from: "rig-signal",
    label: "Rig Signal — the whole arrangement, no joint in focus",
    carries: ["water", "rig"],
    note: "The handoff with no `connectionRequirements` block at all. Its materials are declared one level down, on the architecture, and a reader that only looks in the connection block walks past facts the sender actually stated.",
    packet: {
      ...envelope("rig-signal", "HTH-RS-002", "knot"),
      water: { waterType: "flowing", waterClass: "river" },
      conditions: { waterType: "flowing", depthFt: 8 },
      rigArchitecture: {
        id: "dry-dropper",
        name: "Dry-dropper",
        water: "flowing",
        mainMaterial: "fly-line",
        leaderMaterial: "mono",
        totalLength: 108,
        unit: "in",
        connections: [
          { id: "c-fly-line", where: "Fly line to leader", job: "fly-line-to-leader" },
          { id: "c-tippet", where: "Leader to tippet", job: "leader-to-tippet" },
          { id: "c-dropper", where: "Dry fly to dropper tag", job: "line-to-hook" },
        ],
      },
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: "knot-decision",
    from: "knot-analyst",
    label: "Knot Analyst — a chosen connection",
    carries: ["connection"],
    note: "The end of the chain reporting back, so a trip record can say which joint was actually tied.",
    packet: {
      ...envelope("knot-analyst", "HTH-KA-001", "ops"),
      conditions: { waterType: "surf" },
      knotDecision: {
        knotId: "fg-knot",
        knotName: "FG knot",
        job: "braid-to-leader",
        materials: { main: "braid", leader: "mono" },
        why: "Slim enough to pass the guides on a rig that is cast all day.",
      },
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: "ops-trip",
    from: "field-ops",
    label: "Field Ops Desk — a trip in progress",
    carries: ["water", "conditions", "temperature", "species", "forage", "trip"],
    note: "The spine handing the day to a specialist. Carries the readiness and the open checks so a receiver can see what is still unsettled.",
    packet: {
      ...envelope("field-ops", "HTH-FO-001", "hatch"),
      water: {
        waterId: "mt-madison-lower",
        waterName: "Madison River",
        waterType: "flowing",
        waterClass: "river",
        state: "Montana",
        selectedSpecies: "Brown trout",
      },
      conditions: {
        waterType: "flowing",
        tempF: 54,
        tempSource: "user-measured",
        tempObservedAt: AT,
        flow: "elevated",
        clarity: "stained",
        weather: "front",
        season: "early_summer",
      },
      /* Relayed, not originated. Field Ops carries the access job Field Sense
         declared at the top of the chain; its own place in the day travels in
         the envelope's `intent`, not here. */
      job: { id: "bank", label: "Bank & shoreline", kind: "access" },
      readiness: { score: 62, band: "Plan with checks" },
      openChecks: ["No forage observed yet", "Leader material not stated"],
      observations: { forage: { class: "aquatic_insects", local: "nymphs" } },
      provenance: [{ source: "Angler measurement", evidenceClass: "user-measured", builtAt: AT }],
    },
  },
];

/** Every sample a given instrument would receive — that is, all but its own. */
export function samplesFrom(exclude: string | string[]): FleetSample[] {
  const skip = new Set(Array.isArray(exclude) ? exclude : [exclude]);
  return FLEET_SAMPLES.filter((s) => !skip.has(s.from));
}

/** Samples that carry a given thing, for a receiver that models it. */
export function samplesCarrying(what: FleetSampleCarries): FleetSample[] {
  return FLEET_SAMPLES.filter((s) => s.carries.includes(what));
}

/** The sample ids, for a test that wants to assert coverage rather than shape. */
export const FLEET_SAMPLE_IDS: string[] = FLEET_SAMPLES.map((s) => s.id);
