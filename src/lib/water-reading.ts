import { type Destination, type WaterType } from "@/lib/catalog";
import { readTags } from "@/lib/intelligence";

/* ------------------------------------------------------------------ *
 * Reading the water
 *
 * This module is CRAFT, not observation. It answers "what kind of water
 * am I dealing with, and what should I look for when I get there" from the
 * water's published class and the standing signals the record documents.
 *
 * It never claims to know what this water is doing today. It holds no gauge
 * reading, no clarity, no temperature, no hatch and no fish behaviour. The
 * cues below are the same cues an experienced angler carries between waters;
 * the record only decides which of them are worth putting first.
 * ------------------------------------------------------------------ */

/** How much detail the reader wants. The tool grows with the angler. */
export type ReadLevel = "learning" | "working" | "advanced";

export const READ_LEVELS: Array<{ id: ReadLevel; label: string; note: string }> = [
  { id: "learning", label: "Learning", note: "The few features that matter most" },
  { id: "working", label: "Working", note: "The full standing read for this water class" },
  { id: "advanced", label: "Advanced", note: "Everything, including the subtle reads" },
];

const RANK: Record<ReadLevel, number> = { learning: 0, working: 1, advanced: 2 };

/** A feature to look for, why fish relate to it, and how to find it on the day. */
export interface ReadCue {
  id: string;
  /** Which family of water-reading this belongs to. */
  family: "current" | "structure" | "depth" | "edges" | "cover" | "habitat" | "access";
  title: string;
  /** Lowest level at which this cue is shown. */
  level: ReadLevel;
  /** What the feature is. */
  what: string;
  /** Why it concentrates fish. */
  why: string;
  /** How to find it, standing there. */
  look: string;
}

export interface WaterRead {
  waterClass: WaterType;
  /** One line naming the kind of water this is. */
  headline: string;
  summary: string;
  cues: ReadCue[];
  /** Lines drawn from what THIS record documents, not from the water itself. */
  shaped: string[];
  /** First moves for someone who has never read this class of water. */
  firstMoves: string[];
  limits: string[];
}

export const FAMILY_LABEL: Record<ReadCue["family"], string> = {
  current: "Current",
  structure: "Structure",
  depth: "Depth",
  edges: "Edges",
  cover: "Cover",
  habitat: "Habitat",
  access: "Access",
};

/* ---------------- the craft library, by water class ---------------- */

const RIVER: ReadCue[] = [
  {
    id: "seam",
    family: "current",
    title: "Current seams",
    level: "learning",
    what: "The line where fast water runs against slow — visible as a crease, a change in surface texture, or a trailing foam line.",
    why: "A fish can sit in the slow side and let the fast side deliver food. It is the cheapest lie on the river, so it is usually the first one taken.",
    look: "Stand back and look across, not down. Seams show as a long straight edge in an otherwise broken surface, often below a riffle or beside an obstruction.",
  },
  {
    id: "riffle-run-pool",
    family: "depth",
    title: "Riffle, run, pool, tailout",
    level: "learning",
    what: "A river repeats the same four-part sequence: broken shallow riffle, deeper walking-pace run, slow deep pool, then a shallowing tailout at the pool's exit.",
    why: "Each part holds fish for a different reason and at a different time of day. The run is the workhorse; the tailout and the head of the pool are the feeding stations.",
    look: "Walk the bank and name the parts before you fish anything. If you cannot name where you are standing, you are guessing.",
  },
  {
    id: "outside-bend",
    family: "depth",
    title: "Outside bends and cut banks",
    level: "learning",
    what: "On a bend the current is thrown to the outside, which scours it deep and often undercuts the bank; the inside builds a shallow gravel point bar.",
    why: "Depth, shade and an overhead lid in one place. On a bright day or in low water this is where the better fish are.",
    look: "Follow the bend with your eye: darker water and a hard bank line on the outside, pale gravel on the inside.",
  },
  {
    id: "eddy",
    family: "current",
    title: "Eddies and current breaks",
    level: "working",
    what: "Slack or reversed water behind a boulder, bridge pier, log jam, wing dam or point of bank.",
    why: "A resting lie right beside a feeding lane. Fish move between the two rather than holding in the push all day.",
    look: "Look for the pillow of raised water upstream of the obstruction and the smooth pocket behind it. Fish the pillow as well as the pocket.",
  },
  {
    id: "confluence",
    family: "edges",
    title: "Tributary mouths and confluences",
    level: "working",
    what: "Where a creek or a side channel enters, bringing different temperature, clarity, oxygen and food.",
    why: "A concentration point that works in almost every season, and a refuge when the main stem is high, warm or coloured.",
    look: "The colour or texture line downstream of the junction shows how far the incoming water carries before it mixes. Work that line.",
  },
  {
    id: "wood",
    family: "cover",
    title: "Wood, undercuts and sweepers",
    level: "working",
    what: "Fallen trees, root wads, sweepers hanging into the flow and undercut banks held together by roots.",
    why: "Overhead cover plus a current break. It is also the hardest water to fish cleanly, which is exactly why it holds fish.",
    look: "Read the current going into the wood, not the wood itself — the fish sits where the flow is broken, usually on the upstream or downstream edge, not in the tangle.",
  },
  {
    id: "drop",
    family: "depth",
    title: "Depth changes and shelves",
    level: "working",
    what: "The lip at the head of a pool, a mid-river shelf, a gravel-to-bedrock transition, a dredged slot.",
    why: "Fish use depth changes as travel routes and as ambush points. A one-foot change can matter as much as a ten-foot one.",
    look: "Polarised glasses and a low sun angle. Colour change on the bottom is the cheapest depth sounder there is.",
  },
  {
    id: "foam",
    family: "current",
    title: "Foam and bubble lines",
    level: "advanced",
    what: "The drifting line of foam that traces the strongest thread of surface current.",
    why: "Whatever the river is carrying rides that thread. It marks the delivery lane without you having to guess where it runs.",
    look: "Watch a piece of foam for ten seconds and follow its whole path. Where the line slows, stalls or splits is where the drift piles up.",
  },
  {
    id: "flow-change",
    family: "current",
    title: "How the read changes with flow",
    level: "advanced",
    what: "Every feature above moves as the river rises and falls. High water pushes fish to the margins and inside edges; low water concentrates them into depth and shade.",
    why: "The same pool is three different pools across a season. Reading it once is not reading it.",
    look: "Note the water line against a fixed mark when you arrive, and note it again when you leave. Over a few trips this becomes the most useful thing in your notebook.",
  },
  {
    id: "hydraulics",
    family: "structure",
    title: "Engineered water",
    level: "advanced",
    what: "Wing dams, riprap, bridge abutments, weirs and tailrace outflows all impose hard, predictable current structure on an otherwise natural river.",
    why: "Man-made structure is repeatable. It sits in the same place every trip and produces the same seams and eddies at the same flows.",
    look: "Approach with the release schedule in mind, and treat anything below a dam as water that can change depth without warning.",
  },
];

const LAKE: ReadCue[] = [
  {
    id: "points",
    family: "structure",
    title: "Points, bars and humps",
    level: "learning",
    what: "Land that runs out under the surface: a shoreline point, a submerged bar, an offshore hump rising off the basin.",
    why: "Structure that reaches from shallow to deep lets fish change depth without crossing open water. On a lake with no current, that vertical move is most of what a fish has to work with.",
    look: "Extend every visible point out into the lake with your eye and fish that line, not the tip of the land.",
  },
  {
    id: "weed-edge",
    family: "edges",
    title: "Weed edges and vegetation lines",
    level: "learning",
    what: "The outer edge where submerged weed stops, and the inside edge where it meets the bank.",
    why: "Weed holds invertebrates and fry, produces oxygen and provides ambush cover. The edge is where hunters patrol.",
    look: "On calm water the edge shows as a colour change. Otherwise find it by feel — the depth at which weed stops is usually consistent across the whole lake.",
  },
  {
    id: "breakline",
    family: "depth",
    title: "Breaklines and drop-offs",
    level: "learning",
    what: "The first sharp change from shallow shelf to deeper water, and any further step below it.",
    why: "A highway and a security blanket at once. Fish hold on it, travel along it and drop off it when they are disturbed.",
    look: "Where the bank is steep the break is close in; where the bank is flat the break may be a long way out. The shoreline gradient usually continues underwater.",
  },
  {
    id: "inflow",
    family: "current",
    title: "Inlets, outlets and any moving water",
    level: "working",
    what: "Feeder streams, outflows, aerators and channel necks between basins.",
    why: "Moving water in a still water is a magnet: cooler, better oxygenated and food-bearing. In summer and after rain it can hold most of the active fish in the lake.",
    look: "Fish the fan of the incoming water and the colour line at its edge, and treat necks between two basins as pinch points.",
  },
  {
    id: "cover",
    family: "cover",
    title: "Cover: timber, rock and hard structure",
    level: "working",
    what: "Standing or fallen timber, boulder fields, rock walls, docks, moorings and any built structure with published public access.",
    why: "Hard cover holds heat, grows food and provides ambush lanes. Fish relate to the shaded, current- or wind-protected side.",
    look: "Work the edges and the shade line first. Only go into the tangle when the edges have not produced.",
  },
  {
    id: "flat",
    family: "habitat",
    title: "Flats and basins",
    level: "working",
    what: "The broad shallow shelf and the deep featureless basin — the two places most anglers walk past.",
    why: "Flats feed fish at low light and warm quickly in spring; basins hold suspended fish and bait through the hottest and coldest parts of the year.",
    look: "Fish flats at the edges of the day. Treat a basin as water you search rather than water you pick apart.",
  },
  {
    id: "wind",
    family: "habitat",
    title: "The wind-blown shore",
    level: "advanced",
    what: "The bank the wind has been pushing into, usually for hours before you arrived.",
    why: "Wind stacks plankton against the shore, bait follows it and predators follow the bait. It also breaks the surface and reduces how visible you are.",
    look: "Fish the uncomfortable bank, not the comfortable one — but only inside the exposure and craft limits documented for this water.",
  },
  {
    id: "thermal",
    family: "depth",
    title: "Thermal structure",
    level: "advanced",
    what: "In summer many lakes separate into a warm surface layer, a narrow band of rapid temperature change, and a cold lower layer that can lack oxygen.",
    why: "It sets a floor on where fish can live. Depth without oxygen is empty water no matter how good the structure looks.",
    look: "This is a measurement, not a guess. Take a temperature profile yourself, or fish the depths the season and the species make plausible and let the results correct you.",
  },
];

const RESERVOIR: ReadCue[] = [
  {
    id: "channel",
    family: "structure",
    title: "The old river channel",
    level: "learning",
    what: "The flooded bed of the river or creek the reservoir was built on, still winding along the bottom.",
    why: "It is the deepest, most continuous feature in the impoundment and the main travel route. Almost every good spot on a reservoir is where something else touches the channel.",
    look: "Follow the shape of the valley above the waterline and read it downward — the channel usually runs where the ground falls away fastest.",
  },
  {
    id: "level",
    family: "depth",
    title: "Water level is the whole read",
    level: "learning",
    what: "Reservoirs are managed. Level can move metres within a season for irrigation, power, flood control or drought.",
    why: "Level decides which structure is in the strike zone, which ramps are usable and what is submerged just under the surface.",
    look: "Read the bathtub ring on the bank. Then check the current level and the operating agency's plan before you commit to a launch.",
  },
  {
    id: "arm-point",
    family: "structure",
    title: "Creek arms and secondary points",
    level: "learning",
    what: "The side arms feeding the main body, and the points that step down into them.",
    why: "Arms warm and colour up first, hold spawning and staging fish, and give shelter when the main body is unfishable.",
    look: "Work from the mouth of an arm inward. The secondary point inside the arm is often better than the main-lake point outside it.",
  },
  {
    id: "timber",
    family: "cover",
    title: "Standing timber and flooded structure",
    level: "working",
    what: "Drowned trees, fence lines, roadbeds, foundations and bridges left in place when the valley was filled.",
    why: "Vertical cover in open water: it holds fish at every depth and marks exactly where the old ground contour was.",
    look: "Treat any line of timber as a former edge — a bank, a road or a field boundary. Fish the line, not individual trunks.",
  },
  {
    id: "riprap",
    family: "structure",
    title: "Riprap, the dam face and hard shorelines",
    level: "working",
    what: "Engineered rock along the dam, causeways and bridge approaches.",
    why: "Rock holds heat and crayfish, and the transitions — rock to clay, rock to timber — concentrate fish far more than the middle of a long rock bank.",
    look: "Fish the ends and the changes. A hundred metres of uniform riprap fishes like ten metres repeated ten times.",
  },
  {
    id: "inflow-colour",
    family: "edges",
    title: "Inflow and colour lines",
    level: "working",
    what: "After rain, the upper arms run coloured and a visible line forms where stained water meets clear.",
    why: "A colour line is an edge that fish use exactly like a weed edge or a drop-off, and it moves with the inflow.",
    look: "Follow the line rather than staying on a spot. The line is the structure that day.",
  },
  {
    id: "bluff",
    family: "depth",
    title: "Bluff walls and steep transitions",
    level: "advanced",
    what: "Near-vertical rock walls, usually along the old channel, and the ledges stepping off them.",
    why: "They let fish sit at many depths within a metre of horizontal movement — the fastest way for a fish to follow bait through a changing season.",
    look: "Look for the ledges and the breaks in the wall, and for where the wall ends: the transition out of it usually fishes better than the wall itself.",
  },
  {
    id: "drawdown",
    family: "habitat",
    title: "Reading a drawdown",
    level: "advanced",
    what: "A low-water year exposes the structure you normally fish blind.",
    why: "Walking an exposed reservoir bed in autumn is the single most valuable scouting you can do. It converts guesswork into a map you carry for years.",
    look: "Photograph the exposed channel, stumps and roadbeds against fixed landmarks on the bank so you can find them again when the water is back up.",
  },
];

const MARINE: ReadCue[] = [
  {
    id: "tide",
    family: "current",
    title: "Tide stage sets the terms",
    level: "learning",
    what: "Coastal water is a current system on a clock. The stage of the tide decides depth, direction of flow, and whether a spot is fishable or strands you.",
    why: "A lot of coastal marks give you an hour or two on one stage and go quiet either side of it. Which stage is the mark's own business — you learn it by turning up on the wrong one first.",
    look: "Plan the session around the stage, not the clock. Note the stage that cuts off your exit before you walk out on anything.",
  },
  {
    id: "channel-edge",
    family: "depth",
    title: "Channels, guts and drop-offs",
    level: "learning",
    what: "The deeper cuts draining a flat, the trough between a surf bar and the beach, and the edge of any dredged or natural channel.",
    why: "Fish use them to move on and off shallow ground with the tide and to ambush anything the falling water pulls off the flat.",
    look: "At low water, walk the ground and photograph it. What is invisible at high tide is obvious two hours before it.",
  },
  {
    id: "hard-structure",
    family: "structure",
    title: "Jetties, piers, pilings and rock",
    level: "learning",
    what: "Built structure with published public access — breakwaters, fishing piers, bridge pilings, groynes — plus natural rock and reef.",
    why: "Structure in current creates a permanent eddy and a permanent food chain. It is the most consistent coastal feature there is, and usually the most accessible on foot.",
    look: "Fish the up-current and down-current edges rather than the middle, and re-read them as the tide turns and the current reverses.",
  },
  {
    id: "rips",
    family: "current",
    title: "Rips and current lines",
    level: "working",
    what: "Where flow accelerates around a point, through an inlet or over a bar, and where two bodies of moving water meet.",
    why: "The same seam logic as a river, on a much larger scale. Bait is held disoriented in the turbulence.",
    look: "Look for standing waves, a line of colour or debris, and slicks. Fish the calm side of the line first.",
  },
  {
    id: "bottom-change",
    family: "habitat",
    title: "Bottom transitions",
    level: "working",
    what: "Sand to grass, mud to shell, sand to rock — the edge between two bottom types.",
    why: "Different bottoms grow different food. The boundary carries both, and predators patrol it.",
    look: "On clear flats these read as hard colour changes from a high angle. Elsewhere you find them by feel through the line.",
  },
  {
    id: "surf",
    family: "structure",
    title: "Reading a surf beach",
    level: "working",
    what: "Bar, gutter and cut: the sandbar offshore, the deeper trough inside it, and the gaps where water drains back out.",
    why: "Fish run the gutter and hold at the cuts, where the outgoing water concentrates food.",
    look: "Wave shape gives it away — waves break on the bar, flatten over the gutter, and stay unbroken through a cut.",
  },
  {
    id: "bait-birds",
    family: "habitat",
    title: "Bait and bird activity",
    level: "advanced",
    what: "Working birds, flicking bait, oily slicks and nervous water.",
    why: "It is the only truly live information on the coast, and it is free. It tells you where the food is right now rather than where it usually is.",
    look: "Watch for two minutes before you move. Birds sitting is bait resting; birds diving hard and moving is a feed you have minutes to reach — inside your craft's limits, not outside them.",
  },
  {
    id: "wind-tide",
    family: "current",
    title: "Wind against tide",
    level: "advanced",
    what: "Wind blowing against the direction of tidal flow, stacking a short steep sea.",
    why: "It changes a workable mark into a dangerous one faster than any other coastal factor, and it is entirely predictable in advance.",
    look: "Compare the forecast wind direction with the tidal set for your window before you leave. If they oppose over a bar or an inlet, plan a different mark.",
  },
];

const LIBRARY: Record<WaterType, ReadCue[]> = {
  river: RIVER,
  lake: LAKE,
  reservoir: RESERVOIR,
  marine: MARINE,
};

const HEADLINE: Record<WaterType, string> = {
  river: "Moving water. The read is about current first and depth second.",
  lake: "Still water. The read is about structure and edges, because nothing delivers food to the fish.",
  reservoir:
    "Managed still water over a drowned valley. The read is about the old ground and the current level.",
  marine: "Tidal water. The read is about the stage of the tide and the structure it moves across.",
};

const SUMMARY: Record<WaterType, string> = {
  river:
    "A river hands you the fish's problem for free: it has to hold somewhere it can eat without swimming hard all day. Find the places where fast water and slow water meet, and you have found where to start on most rivers, including ones you have never seen before.",
  lake: "On a still water nothing brings food to the fish, so the fish has to go to the food. That makes structure and edges everything: points, drop-offs, weed lines and anything that lets a fish move between shallow and deep without crossing open water.",
  reservoir:
    "A reservoir is a flooded valley with the old ground still underneath it. Read the land above the waterline and continue it downward, then let the current water level tell you which of that structure is actually in play today.",
  marine:
    "Coastal water is a clock as much as a place. The same mark is three different marks across a tide, so before you pick the mark, work out the window: which stage you want, and what the water will be doing then.",
};

const FIRST_MOVES: Record<WaterType, string[]> = {
  river: [
    "Before you make a cast, walk a hundred metres of bank and name what you see: riffle, run, pool, tailout.",
    "Pick one seam and fish it properly rather than covering five features badly.",
    "Fish the near water first. Most people wade through the fish they came for.",
  ],
  lake: [
    "Find the first depth change out from the bank before you decide anything else.",
    "Extend every visible point out into the water with your eye and start there.",
    "Fish the edge of the weed, not the middle of it.",
  ],
  reservoir: [
    "Look at the shape of the valley above the waterline and follow it into the water.",
    "Check the current level and what the managing agency says about it before you pick a ramp.",
    "Start where a creek arm meets the main body — that junction is a whole day's fishing on its own.",
  ],
  marine: [
    "Read the tide table first and choose your window before you choose your mark.",
    "Walk the ground at low water once. It is worth more than ten sessions of guessing.",
    "Decide, out loud, the tide stage at which you will leave — and then leave at it.",
  ],
};

/** Species families that reliably change which cues matter first. */
const SPECIES_SHAPE: Array<{ rx: RegExp; note: string }> = [
  {
    rx: /trout|salmon|char|steelhead|grayling|whitefish/i,
    note: "Cold-water species are documented here. Read for oxygen and temperature as much as for cover: broken water, inflows, shade and depth.",
  },
  {
    rx: /bass|pike|muskell?unge|musky|pickerel/i,
    note: "Ambush predators are documented here. Cover and hard edges do more work than open water — read the shade line and the first structure a fish can hide behind.",
  },
  {
    rx: /walleye|sauger|zander/i,
    note: "Low-light feeders are documented here. Read breaklines and hard-bottom edges, and weight the ends of the day.",
  },
  {
    rx: /catfish|carp|sturgeon|buffalo|drum/i,
    note: "Bottom-oriented species are documented here. Read depth changes, holes and slack water where the current drops what it is carrying.",
  },
  {
    rx: /redfish|red drum|snook|tarpon|bonefish|permit|seatrout|spotted sea|flounder|striped bass|striper/i,
    note: "Inshore predators are documented here. Read the tide's direction across structure — the edge that drains a flat is worth more than the flat itself.",
  },
  {
    rx: /panfish|bluegill|crappie|perch|sunfish/i,
    note: "Schooling panfish are documented here. Read vegetation edges and shallow structure, and expect the school to hold tighter than a single feature suggests.",
  },
];

/**
 * Build the standing water-read for a record.
 *
 * Everything in `cues` is general craft for the water class. Everything in
 * `shaped` is drawn from what this record documents. Neither is an observation
 * of the water today.
 */
export function readWater(d: Destination): WaterRead {
  const t = readTags(d);
  const cls = d.waterType;
  const shaped: string[] = [];

  if (t.hazards.has("current")) {
    shaped.push(
      "Current and flow are documented as a standing factor on this water. Read seams and current breaks first, and treat depth as the second question.",
    );
  }
  if (t.hazards.has("level")) {
    shaped.push(
      "Level swing and submerged hazards are on record here. The structure you can read changes with the level, and so does what is sitting just under the surface.",
    );
  }
  if (t.hazards.has("tide")) {
    shaped.push(
      "Tide is documented on this record. Fix your window and your exit stage before you read anything else.",
    );
  }
  if (t.hazards.has("wind")) {
    shaped.push(
      "Wind and fetch are documented characteristics of this water. The wind-blown bank is usually the productive read and the uncomfortable one — take it only within the exposure your craft and the record support.",
    );
  }
  if (t.hazards.has("ice")) {
    shaped.push(
      "Cold-water exposure is on record. Cold slows fish and pushes them to deeper, slower water; it also shortens how long a mistake stays recoverable.",
    );
  }
  if (t.hazards.has("traffic")) {
    shaped.push(
      "Vessel traffic is documented here. Structure inside a navigation channel is not water you fish, however well it reads.",
    );
  }
  if (t.hazards.has("algae")) {
    shaped.push(
      "Algal advisories are on record for this water. Bloom conditions change where fish will hold as well as whether contact is advisable.",
    );
  }

  if (t.directoryOnly) {
    shaped.push(
      "This record documents a network of official access sites rather than one site. The read below applies once you have chosen a named site from the official directory.",
    );
  } else if (t.hasShoreAccess && !t.hasOpenLaunch) {
    shaped.push(
      "Access here is documented from the shore. Read the first two rod-lengths of water before you wade or walk past them — the bank margin is a feature, not a route to the fishing.",
    );
  } else if (t.hasOpenLaunch && !t.hasShoreAccess) {
    shaped.push(
      "Access here is documented as launch-led. Plan the read as a route between features rather than as a single stand.",
    );
  }

  const species = d.speciesContext.join(" ");
  for (const s of SPECIES_SHAPE) {
    if (s.rx.test(species)) {
      shaped.push(s.note);
      break;
    }
  }

  if (t.datedClosures > 0) {
    shaped.push(
      `${t.datedClosures} dated harvest closure${t.datedClosures === 1 ? " is" : "s are"} recorded on the standing season. Reading water well does not change what you may keep.`,
    );
  }

  return {
    waterClass: cls,
    headline: HEADLINE[cls],
    summary: SUMMARY[cls],
    cues: LIBRARY[cls],
    shaped,
    firstMoves: FIRST_MOVES[cls],
    limits: [
      "This is standing craft for this class of water, not an observation of this water today.",
      "No clarity, temperature, level, flow, tide height or hatch is held here, and none is estimated.",
      "Which features actually exist on this particular water is for you to confirm on the ground or from the official source.",
      "Nothing here identifies a spot. It describes what to look for, not where to stand.",
    ],
  };
}

/** Cues at or below the reader's declared level. */
export function cuesFor(read: WaterRead, level: ReadLevel): ReadCue[] {
  return read.cues.filter((c) => RANK[c.level] <= RANK[level]);
}
