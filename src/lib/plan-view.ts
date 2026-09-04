/**
 * Plan view — the water from above.
 *
 * The section plate answers "how far out and how deep". It is the right
 * drawing for a bank you are already standing on, and it is the wrong drawing
 * for the question anglers actually ask first, which is *where along here*.
 * A cross-section cannot show you an inside bend, a windward shore, a creek
 * arm, a rip cut, or the fact that the good bank moved overnight because the
 * wind swung. Those are plan-view facts, and the instrument had no plan view.
 *
 * So this is the map. Not a hotspot map — there are no real places in here at
 * all. It is a schematic of a *kind* of water with its features named, and it
 * has one thing no static diagram has: the conditions are a control. Turn the
 * wind dial and the shore that is worth walking moves around the basin. Drop
 * the reservoir and the old channel comes up out of the flat. Put the river
 * in flood and the middle goes quiet while the edges light up.
 *
 * The rules that keep this honest are the ones the rest of the app already
 * lives by:
 *
 *  1. **It is craft, not a survey.** No zone here claims to exist at any named
 *     water. It claims that water of this class usually has one, and tells you
 *     how to find it when you get there.
 *  2. **Nothing predicts fish.** A zone lighting up means the physical
 *     conditions that make it interesting are present, not that anything is
 *     living in it today.
 *  3. **Every state change carries its reason.** If the drawing changes, the
 *     app says in one sentence what changed and why. A diagram that rearranges
 *     itself silently is a magic trick, not an explanation.
 */

import type { WaterType } from "@/lib/catalog";
import type { ReadLevel } from "@/lib/water-reading";

/* ------------------------------------------------------------------ */
/* State the reader controls                                           */
/* ------------------------------------------------------------------ */

export const WIND_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type WindPoint = (typeof WIND_POINTS)[number];

/** Compass bearing the wind is coming FROM. */
export const WIND_BEARING: Record<WindPoint, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

export const WATER_STATES = [
  "settled",
  "rising",
  "falling",
  "low-clear",
  "release",
  "drawdown",
] as const;
export type PlanWaterState = (typeof WATER_STATES)[number];

export const WATER_STATE_LABEL: Record<PlanWaterState, string> = {
  settled: "Settled",
  rising: "Rising / coloured",
  falling: "Falling and clearing",
  "low-clear": "Low and clear",
  release: "Generating / release",
  drawdown: "Drawn down",
};

export const TIDES = ["flood", "high", "ebb", "low"] as const;
export type TideState = (typeof TIDES)[number];

export const TIDE_LABEL: Record<TideState, string> = {
  flood: "Flooding",
  high: "High slack",
  ebb: "Ebbing",
  low: "Low slack",
};

export type PlanState = {
  wind: WindPoint | null;
  water: PlanWaterState;
  tide: TideState | null;
};

export const DEFAULT_PLAN_STATE: PlanState = { wind: null, water: "settled", tide: null };

/* ------------------------------------------------------------------ */
/* The schematic                                                       */
/* ------------------------------------------------------------------ */

export type PlanKind = "river-reach" | "lake-basin" | "reservoir-arm" | "coast";

export type Emphasis = "strong" | "normal" | "quiet" | "off";

export type PlanZone = {
  id: string;
  label: string;
  /** What the feature is, physically. */
  what: string;
  /** Why fish relate to it. Never "fish will be here". */
  why: string;
  /** How to find it standing there, with no map. */
  look: string;
  level: ReadLevel;
  /** Anchor as a fraction of the canvas. */
  at: { x: number; y: number };
  /** Marker radius as a fraction of canvas width. Bigger = broader feature. */
  r?: number;
  /**
   * Which way the open water lies from this piece of shore, as a compass
   * bearing. Wind coming from this bearing is blowing straight onto it.
   * Null for features that are not a piece of shoreline.
   */
  facing?: number | null;
  /** How much open water is upwind when the wind is on it. 0–1. */
  exposure?: number;
  /** How this feature answers to the water state. */
  water?: Partial<Record<PlanWaterState, { emphasis: Emphasis; note: string }>>;
  /** How this feature answers to the tide. Coast only. */
  tide?: Partial<Record<TideState, { emphasis: Emphasis; note: string }>>;
};

export type PlanSchematic = {
  kind: PlanKind;
  title: string;
  caption: string;
  /** True when the wind dial is meaningful for this kind of water. */
  windMatters: boolean;
  /** True when the tide control should be shown. */
  tideMatters: boolean;
  /** Which water states this schematic actually models. */
  states: PlanWaterState[];
  zones: PlanZone[];
};

export type ZoneRead = {
  zone: PlanZone;
  emphasis: Emphasis;
  /** The reasons the emphasis is what it is. Never more than two. */
  notes: string[];
};

/* ------------------------------------------------------------------ */
/* River reach                                                         */
/* ------------------------------------------------------------------ */

const RIVER: PlanSchematic = {
  kind: "river-reach",
  title: "A reach of river, seen from above",
  caption:
    "One meander with the water moving left to right. Every river you will ever stand on is some version of this repeated — riffle, run, pool, tailout, and the bend that builds all four.",
  windMatters: false,
  tideMatters: false,
  states: ["settled", "rising", "falling", "low-clear", "release"],
  zones: [
    {
      id: "riffle",
      label: "Riffle",
      what: "Shallow, broken, fast water over cobble at the head of the bend.",
      why: "It makes the oxygen and grows most of the insect life in the reach. Broken surface also hides a fish from everything above it.",
      look: "White, noisy, ankle to knee deep, and you can hear it before you see it.",
      level: "learning",
      at: { x: 0.14, y: 0.42 },
      r: 0.05,
      water: {
        rising: {
          emphasis: "quiet",
          note: "Too much push. A riffle in flood is a wall of water, not a feeding lane.",
        },
        "low-clear": {
          emphasis: "strong",
          note: "In low clear water the riffle is the only cover left. Broken surface is the whole reason it still holds fish.",
        },
        release: {
          emphasis: "quiet",
          note: "First water to become unfishable when they turn it on.",
        },
      },
    },
    {
      id: "run",
      label: "Run",
      what: "The even, waist-deep, walking-pace water below the riffle.",
      why: "Steady current delivering food at a speed a fish can hold in without working. The most consistently occupied water in the reach and the least dramatic to look at.",
      look: "Smooth but moving, a darker green than the riffle above it.",
      level: "learning",
      at: { x: 0.29, y: 0.5 },
      r: 0.055,
      water: {
        falling: {
          emphasis: "strong",
          note: "Falling water pushes fish back into the runs from the edges they used on the rise.",
        },
      },
    },
    {
      id: "outside-bend",
      label: "Outside bend / cut bank",
      what: "The far side of the curve, where the current is thrown and the bank is being eaten.",
      why: "Deepest water in the reach, usually with an undercut and often with the whole bank's worth of fallen timber in it.",
      look: "The bank with no beach — steep, raw, sometimes with roots hanging in the water.",
      level: "learning",
      at: { x: 0.52, y: 0.24 },
      r: 0.06,
      water: {
        "low-clear": {
          emphasis: "strong",
          note: "When everything else is thin, the deep outside of the bend is what is left.",
        },
        rising: {
          emphasis: "quiet",
          note: "In flood the outside bend carries the worst of the current and the debris with it.",
        },
      },
    },
    {
      id: "inside-bend",
      label: "Inside bend / point bar",
      what: "The shallow gravel shelf on the near side of the curve, built out of what the outside bank lost.",
      why: "Ordinary water most days. On a rise it becomes the softest fishable water in the reach, and it is where fish go to stop swimming.",
      look: "The side with the beach. You are usually standing on it.",
      level: "working",
      at: { x: 0.5, y: 0.72 },
      r: 0.06,
      water: {
        settled: { emphasis: "quiet", note: "Thin and exposed at normal flow." },
        rising: {
          emphasis: "strong",
          note: "This is the refuge on a rise — soft water on the inside of the push, with the bank's food washing into it.",
        },
        release: {
          emphasis: "strong",
          note: "When they turn the water on, the inside of the bend is the first place that is still fishable.",
        },
        "low-clear": { emphasis: "off", note: "Barely wet, and you can be seen from anywhere." },
      },
    },
    {
      id: "seam",
      label: "Current seam",
      what: "The visible line where fast water runs against slow.",
      why: "A fish can sit in the slow half and eat out of the fast half. It is the single most reliable piece of moving-water reading there is.",
      look: "A crease on the surface, often with bubbles or foam tracking down it.",
      level: "learning",
      at: { x: 0.4, y: 0.4 },
      r: 0.045,
      water: {
        rising: {
          emphasis: "strong",
          note: "A rise creates new seams along every edge. They move inshore as the water climbs.",
        },
      },
    },
    {
      id: "pool",
      label: "Pool",
      what: "The deep slow section below the bend.",
      why: "Depth, temperature stability and safety. Fish rest here rather than feed here, which is why it looks like the best water and often fishes like the worst.",
      look: "Dark, flat, and quiet. The bit that looks fishy in photographs.",
      level: "working",
      at: { x: 0.66, y: 0.44 },
      r: 0.06,
      water: {
        "low-clear": {
          emphasis: "strong",
          note: "In a drought the pool is the reservoir the whole reach retreats into.",
        },
        rising: { emphasis: "normal", note: "Still the calmest water available in a flood." },
      },
    },
    {
      id: "tailout",
      label: "Tailout",
      what: "The shallowing, accelerating water at the bottom of the pool before the next riffle.",
      why: "Everything drifting through the pool gets funnelled into a narrowing band here. It is the pool's checkout counter.",
      look: "The pool getting shallower and the surface starting to tighten and move.",
      level: "working",
      at: { x: 0.79, y: 0.53 },
      r: 0.045,
      water: {
        "low-clear": {
          emphasis: "quiet",
          note: "Shallow, glassy, and the easiest place on the river to be seen.",
        },
        falling: { emphasis: "strong", note: "Falling water concentrates the drift here first." },
      },
    },
    {
      id: "eddy",
      label: "Eddy behind structure",
      what: "The reversed pocket of slack water immediately downstream of a boulder or a log jam.",
      why: "A fish can hold there for free while food circles past. Free is the whole business model.",
      look: "Water going the wrong way, or a slick that stays still while everything around it moves.",
      level: "working",
      at: { x: 0.36, y: 0.62 },
      r: 0.04,
      water: {
        rising: {
          emphasis: "strong",
          note: "Every eddy gets bigger and softer as the river fills.",
        },
        release: {
          emphasis: "strong",
          note: "The pockets behind hard structure are the only slack water left once they open the gates.",
        },
      },
    },
    {
      id: "tributary",
      label: "Tributary mouth",
      what: "Where a side creek enters the reach.",
      why: "Two different temperatures, two different colours and a delivery of food, all in one place. In a summer heatwave it can be several degrees of difference.",
      look: "A colour line, a gravel fan pushed out into the main flow, or just a gap in the bank vegetation.",
      level: "working",
      at: { x: 0.86, y: 0.28 },
      r: 0.045,
      water: {
        rising: {
          emphasis: "strong",
          note: "On a rise the tributary often runs clearer than the main river, and the clean water is worth finding.",
        },
        "low-clear": {
          emphasis: "strong",
          note: "In heat the cooler inflow is the most valuable water in the reach.",
        },
      },
    },
    {
      id: "undercut",
      label: "Undercut and overhang",
      what: "Bank cut away beneath the waterline, usually with a tree over it.",
      why: "Overhead cover with current delivery attached. It is the whole package, and it is why the best fish in a reach are so often somewhere you cannot easily cast.",
      look: "A bank that hangs over its own reflection. Look for the shadow line, not the bank.",
      level: "advanced",
      at: { x: 0.62, y: 0.18 },
      r: 0.04,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Lake basin                                                          */
/* ------------------------------------------------------------------ */

const LAKE: PlanSchematic = {
  kind: "lake-basin",
  title: "A lake basin, seen from above",
  caption:
    "No current to read, so the shape of the shore and the direction of the wind do all the work. Turn the dial and watch which bank stops being ordinary.",
  windMatters: true,
  tideMatters: false,
  states: ["settled", "rising", "falling", "low-clear"],
  zones: [
    {
      id: "north-shore",
      label: "North shore",
      what: "The bank on the north side, facing south across the basin.",
      why: "Which bank matters is a wind question, not a compass question. This one earns its keep when the wind is blowing into it.",
      look: "Stand on it and look upwind. What you can see is the fetch.",
      level: "learning",
      at: { x: 0.5, y: 0.14 },
      r: 0.05,
      facing: 180,
      exposure: 0.9,
    },
    {
      id: "south-shore",
      label: "South shore",
      what: "The bank on the south side, facing north across the basin.",
      why: "Same logic, opposite side. On a lake the good bank is decided overnight by the weather, not by the map.",
      look: "Foam, floating debris and a scummy line at the waterline means the drift has been arriving here.",
      level: "learning",
      at: { x: 0.5, y: 0.86 },
      r: 0.05,
      facing: 0,
      exposure: 0.9,
    },
    {
      id: "west-shore",
      label: "West shore",
      what: "The bank on the west side, facing east.",
      why: "Also the bank that gets first light and loses it earliest — worth knowing on a clear-water lake where shade is cover.",
      look: "Where the sun is, and where the shadow of the bank falls on the water.",
      level: "working",
      at: { x: 0.13, y: 0.5 },
      r: 0.05,
      facing: 90,
      exposure: 0.7,
    },
    {
      id: "east-shore",
      label: "East shore",
      what: "The bank on the east side, facing west.",
      why: "Holds shade latest into the morning and takes the evening sun full on.",
      look: "The last bank to come out of shadow.",
      level: "working",
      at: { x: 0.87, y: 0.5 },
      r: 0.05,
      facing: 270,
      exposure: 0.7,
    },
    {
      id: "point",
      label: "Main-lake point",
      what: "A finger of land running out into open water, with its underwater extension carrying on past the tip.",
      why: "It intercepts anything travelling along the shore and gives access to deep water in one short move. Points are the crossroads of a lake.",
      look: "The land narrows and the waves wrap around the end of it. The good part is usually further out than the land suggests.",
      level: "learning",
      at: { x: 0.32, y: 0.3 },
      r: 0.055,
      facing: 225,
      exposure: 1,
      water: {
        "low-clear": {
          emphasis: "strong",
          note: "With the lake down, the point's underwater extension is visible — walk it and remember it.",
        },
      },
    },
    {
      id: "weed-edge",
      label: "Weed edge",
      what: "The outside line where the weed bed stops and open water starts.",
      why: "Cover on one side, room to hunt on the other, and everything small living in the middle of it. An edge is always worth more than the field behind it.",
      look: "A colour change from dark to clear, or the last weed coming up on your line.",
      level: "learning",
      at: { x: 0.28, y: 0.68 },
      r: 0.06,
      facing: 45,
      exposure: 0.35,
      water: {
        falling: {
          emphasis: "strong",
          note: "As the level drops the weed edge moves out with it, and the old line becomes too shallow.",
        },
      },
    },
    {
      id: "drop-off",
      label: "Drop-off",
      what: "Where the shallow shelf ends and the bottom falls into the basin.",
      why: "A road. Fish move shallow to feed and deep to rest, and they use the drop to do both without crossing open water.",
      look: "A distinct change in wave behaviour, or the moment your line stops finding bottom.",
      level: "working",
      at: { x: 0.55, y: 0.55 },
      r: 0.06,
    },
    {
      id: "inflow",
      label: "Inflow",
      what: "Where a stream enters the lake.",
      why: "Moving water, oxygen, food delivery and a different temperature — the only current a lake has.",
      look: "A fan of clean gravel, a colour plume, or a gap in the trees on the bank.",
      level: "working",
      at: { x: 0.72, y: 0.19 },
      r: 0.045,
      facing: 200,
      exposure: 0.3,
      water: {
        rising: {
          emphasis: "strong",
          note: "After rain the inflow is doing the most work it will do all season.",
        },
        "low-clear": {
          emphasis: "strong",
          note: "In a heatwave the inflow may be the only cool water in the lake.",
        },
      },
    },
    {
      id: "shallow-bay",
      label: "Shallow bay",
      what: "A protected arm out of the main basin.",
      why: "Warms first in spring, holds the season's first weed and the season's first fry. Also the first place to become unbearable in high summer.",
      look: "Colour, warmth, and usually the most vegetation.",
      level: "working",
      at: { x: 0.72, y: 0.74 },
      r: 0.06,
      facing: 315,
      exposure: 0.15,
      water: {
        "low-clear": { emphasis: "quiet", note: "First water to go too warm and too thin." },
      },
    },
    {
      id: "hump",
      label: "Offshore hump",
      what: "A rise in the bottom out in open water, with nothing above the surface to mark it.",
      why: "Shallow water surrounded by deep water, with no bank attached and no bank anglers on it. Everything a point does, without the walk-up.",
      look: "You will not see it. This one is an electronics or a contour-map feature, and it is the reason people buy both.",
      level: "advanced",
      at: { x: 0.6, y: 0.36 },
      r: 0.04,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Reservoir arm                                                       */
/* ------------------------------------------------------------------ */

const RESERVOIR: PlanSchematic = {
  kind: "reservoir-arm",
  title: "A reservoir arm, seen from above",
  caption:
    "A drowned valley, which means there is a river under it. The old channel is the spine of everything here, and the level moving is the event that matters most.",
  windMatters: true,
  tideMatters: false,
  states: ["settled", "rising", "falling", "low-clear", "drawdown", "release"],
  zones: [
    {
      id: "old-channel",
      label: "Old river channel",
      what: "The original streambed running down the middle of the arm, now under water.",
      why: "The deepest continuous water in the arm and the route fish use to move up and down it. Everything else in a reservoir is arranged around this line.",
      look: "On a contour map it is obvious. On the water, look for the steepest bank — the channel usually runs against it.",
      level: "learning",
      at: { x: 0.5, y: 0.5 },
      r: 0.07,
      water: {
        drawdown: {
          emphasis: "strong",
          note: "This is the whole point of a drawdown. The channel is exposed, walkable and memorisable — the map you cannot buy.",
        },
        "low-clear": {
          emphasis: "strong",
          note: "With the flat dry, the channel is what is left holding water.",
        },
      },
    },
    {
      id: "channel-swing",
      label: "Channel swing bank",
      what: "Where the old channel runs hard against one side of the arm.",
      why: "Deep water directly against the bank. It is the only place in a reservoir arm where a bank angler can reach the channel.",
      look: "The steepest, rockiest bank in the arm. Usually the ugly one.",
      level: "working",
      at: { x: 0.35, y: 0.35 },
      r: 0.05,
      facing: 200,
      exposure: 0.6,
    },
    {
      id: "flat",
      label: "Shallow flat",
      what: "The broad shelf between the bank and the channel — the old floodplain.",
      why: "Where a reservoir does its feeding, when the level is up enough to make it usable.",
      look: "Wide, even, and shallow. On a drawdown it is the mud you are walking across.",
      level: "learning",
      at: { x: 0.68, y: 0.68 },
      r: 0.07,
      facing: 315,
      exposure: 0.4,
      water: {
        rising: {
          emphasis: "strong",
          note: "Rising water floods dry ground, and freshly flooded ground is the richest thing in a reservoir. Food and cover become available on the same day.",
        },
        drawdown: {
          emphasis: "off",
          note: "Dry. Walk it, photograph it, and remember it for when the lake fills.",
        },
        falling: {
          emphasis: "quiet",
          note: "Emptying. Fish leave a falling flat before you think they have.",
        },
      },
    },
    {
      id: "timber",
      label: "Standing timber",
      what: "Trees left in place when the valley was flooded.",
      why: "Vertical cover through the whole water column, so a fish can change depth without leaving cover.",
      look: "Stumps, snags, or a straight line of them following an old fence or hedge.",
      level: "working",
      at: { x: 0.42, y: 0.7 },
      r: 0.05,
    },
    {
      id: "creek-mouth",
      label: "Creek arm mouth",
      what: "Where a side arm joins the main arm.",
      why: "A funnel. Everything moving in or out of the back of that arm has to pass through here, and the two bodies of water are often different colours.",
      look: "A visible narrowing, and frequently a colour line across it.",
      level: "working",
      at: { x: 0.79, y: 0.32 },
      r: 0.05,
      facing: 250,
      exposure: 0.35,
      water: {
        rising: {
          emphasis: "strong",
          note: "The back of the arm colours up first and the mouth becomes the clean-to-dirty edge.",
        },
      },
    },
    {
      id: "riprap",
      label: "Riprap and dam face",
      what: "Engineered rock — the dam itself, causeways, bridge abutments.",
      why: "Rock holds heat and grows invertebrates, and the angle gives every depth within one cast. It is artificial structure that behaves like a natural bluff.",
      look: "Obvious. It is the only straight line on the water.",
      level: "learning",
      at: { x: 0.14, y: 0.52 },
      r: 0.05,
      facing: 90,
      exposure: 0.8,
      water: {
        release: {
          emphasis: "strong",
          note: "Generating pulls water past the dam face and turns a wall into a current feature.",
        },
      },
    },
    {
      id: "back-of-arm",
      label: "Back of the arm",
      what: "The shallow, silty top end where the feeder stream comes in.",
      why: "First to warm, first to colour, first to fish in spring and first to be unfishable after rain.",
      look: "The end of the navigable water, usually with a colour change.",
      level: "working",
      at: { x: 0.9, y: 0.72 },
      r: 0.05,
      water: {
        rising: {
          emphasis: "quiet",
          note: "First to turn to chocolate. The clean edge moves down the arm towards you.",
        },
        drawdown: { emphasis: "off", note: "Usually dry, or a stream running through mud." },
      },
    },
    {
      id: "secondary-point",
      label: "Secondary point",
      what: "A point inside the arm rather than out on the main lake.",
      why: "Fish moving between the channel and the back of the arm stage on these. They are the steps in the staircase.",
      look: "A minor finger of land partway up the arm, often barely noticeable from a boat.",
      level: "advanced",
      at: { x: 0.6, y: 0.24 },
      r: 0.045,
      facing: 200,
      exposure: 0.5,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Coast                                                               */
/* ------------------------------------------------------------------ */

const COAST: PlanSchematic = {
  kind: "coast",
  title: "A stretch of coast, seen from above",
  caption:
    "Beach, bar, trough and a rip, with an estuary mouth at one end. The tide is the current here, and it rearranges the whole picture twice a day.",
  windMatters: true,
  tideMatters: true,
  states: ["settled", "rising", "falling"],
  zones: [
    {
      id: "trough",
      label: "Inshore trough / gutter",
      what: "The deeper channel running parallel to the beach, between the sand at your feet and the outer bar.",
      why: "It is a road running along the beach, deep enough to stay usable in daylight and often close enough to reach with a short cast.",
      look: "The darker band of water between the shore break and the line of breakers further out.",
      level: "learning",
      at: { x: 0.42, y: 0.6 },
      r: 0.07,
      facing: 0,
      exposure: 0.8,
      tide: {
        flood: { emphasis: "strong", note: "Filling, and fish move into it with the water." },
        low: {
          emphasis: "quiet",
          note: "At low slack the trough may be too thin to hold anything in daylight.",
        },
      },
    },
    {
      id: "bar",
      label: "Outer bar",
      what: "The raised sand ridge the waves are breaking on.",
      why: "Breaking water stirs food out of the sand and puts oxygen in. The bar itself is less interesting than its edges.",
      look: "The line of white water some distance out, with calmer water either side of it.",
      level: "learning",
      at: { x: 0.42, y: 0.4 },
      r: 0.06,
      facing: 0,
      exposure: 1,
      tide: {
        low: {
          emphasis: "strong",
          note: "At low water the bar is exposed or nearly so. Walk out and read the whole system — this is the survey you cannot do at any other time.",
        },
        high: { emphasis: "normal", note: "Covered, and the break moves shorewards." },
      },
    },
    {
      id: "rip",
      label: "Rip cut",
      what: "The gap in the bar where the water that came over it escapes back out.",
      why: "Everything the surf lifted off the beach drains through one narrow gap. It is the most reliable food conveyor on an open beach, and it is also the thing that will drown a swimmer.",
      look: "A gap in the line of breakers with darker, choppy, seaward-moving water in it.",
      level: "learning",
      at: { x: 0.6, y: 0.46 },
      r: 0.05,
      facing: 0,
      exposure: 0.9,
      tide: {
        ebb: {
          emphasis: "strong",
          note: "An ebb tide drives the rip hardest. The conveyor is running.",
        },
        high: { emphasis: "quiet", note: "Slack water, and the cut stops doing its job." },
        low: { emphasis: "quiet", note: "Slack again, and often too shallow to work." },
      },
    },
    {
      id: "estuary",
      label: "Estuary mouth",
      what: "Where a river or a creek meets the sea.",
      why: "Two water types, a hard current, a food delivery on every ebb, and a hard bottom edge where the channel cuts through the sand.",
      look: "The colour line, the standing chop where the currents meet, and the birds.",
      level: "learning",
      at: { x: 0.83, y: 0.66 },
      r: 0.06,
      facing: 340,
      exposure: 0.5,
      tide: {
        ebb: {
          emphasis: "strong",
          note: "The ebb drains the marsh and the flats through this one gap, and every ambush point in it faces the outgoing water.",
        },
        flood: {
          emphasis: "normal",
          note: "Fish push in on the flood, following the clean water up.",
        },
      },
      water: {
        rising: {
          emphasis: "strong",
          note: "River in spate means the freshwater plume pushes further out and the colour edge moves with it.",
        },
      },
    },
    {
      id: "flat",
      label: "Tidal flat",
      what: "The shallow ground inside the estuary that dries at low water.",
      why: "The pantry. It is only accessible for part of the cycle, which is precisely why fish work it hard when it is.",
      look: "Mud, sand or weed, uncovered at low tide and gone at high.",
      level: "working",
      at: { x: 0.9, y: 0.85 },
      r: 0.055,
      tide: {
        flood: {
          emphasis: "strong",
          note: "Flooding onto dry ground, and fish follow the edge of the water as it goes.",
        },
        low: { emphasis: "off", note: "Dry. Walk it and look at where the drains run." },
        ebb: {
          emphasis: "quiet",
          note: "Emptying — the interest moves to the drains carrying the flat's contents out.",
        },
      },
    },
    {
      id: "headland",
      label: "Rocky point / headland",
      what: "Hard ground running out into the tide at the end of the beach.",
      why: "It bends the tidal current, holds weed and crustaceans the sand cannot, and puts deep water within reach of a standing angler.",
      look: "Rock, white water on the tip, and a visible line where the current shears past it.",
      level: "working",
      at: { x: 0.15, y: 0.44 },
      r: 0.055,
      facing: 300,
      exposure: 1,
      tide: {
        flood: {
          emphasis: "strong",
          note: "Running tide, and the shear line off the point is live.",
        },
        ebb: { emphasis: "strong", note: "Same again in reverse — moving water is the point." },
        high: { emphasis: "quiet", note: "Slack. The feature stops working until the tide turns." },
        low: {
          emphasis: "quiet",
          note: "Slack again, and on a low tide the shear line has usually moved off the end of the rock entirely.",
        },
      },
    },
    {
      id: "weed-line",
      label: "Weed and reef edge",
      what: "The margin between rock or kelp and clean sand.",
      why: "Two habitats meeting, with everything that lives in one hunting across the other. Edges again — it is always edges.",
      look: "A colour boundary from dark to pale, visible from height on a calm day.",
      level: "advanced",
      at: { x: 0.24, y: 0.68 },
      r: 0.05,
      facing: 330,
      exposure: 0.6,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Selection and reading                                               */
/* ------------------------------------------------------------------ */

const BY_TYPE: Record<WaterType, PlanSchematic> = {
  river: RIVER,
  lake: LAKE,
  reservoir: RESERVOIR,
  marine: COAST,
};

export function schematicFor(waterType: WaterType): PlanSchematic {
  return BY_TYPE[waterType];
}

export const ALL_SCHEMATICS: PlanSchematic[] = [RIVER, LAKE, RESERVOIR, COAST];

const RANK: Record<ReadLevel, number> = { learning: 0, working: 1, advanced: 2 };

export function zonesFor(schematic: PlanSchematic, level: ReadLevel): PlanZone[] {
  return schematic.zones.filter((z) => RANK[z.level] <= RANK[level]);
}

/** Smallest angle between two compass bearings, 0–180. */
export function bearingDelta(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * How hard the wind is on this piece of shore.
 *
 * +1 means straight on, -1 means straight off, 0 means along it. Scaled by
 * exposure, because two hundred yards of sheltered arm and two miles of open
 * water are the same bearing and completely different days.
 */
export function windLoad(zone: PlanZone, wind: WindPoint | null): number | null {
  if (!wind || zone.facing == null) return null;
  const delta = bearingDelta(WIND_BEARING[wind], zone.facing);
  const alignment = Math.cos((delta * Math.PI) / 180);
  return alignment * (zone.exposure ?? 0.5);
}

function step(emphasis: Emphasis, direction: 1 | -1): Emphasis {
  const order: Emphasis[] = ["off", "quiet", "normal", "strong"];
  const index = order.indexOf(emphasis);
  const next = Math.min(order.length - 1, Math.max(0, index + direction));
  return order[next] ?? emphasis;
}

/**
 * Read one zone under the current state.
 *
 * Order matters and is deliberate: the water state is applied first because a
 * dry flat is dry whatever the wind is doing, then the tide, then the wind
 * nudges what is left. A zone the water state has switched off cannot be
 * turned back on by a breeze.
 */
export function readZone(zone: PlanZone, state: PlanState): ZoneRead {
  let emphasis: Emphasis = "normal";
  const notes: string[] = [];

  const water = zone.water?.[state.water];
  if (water) {
    emphasis = water.emphasis;
    notes.push(water.note);
  }

  if (emphasis !== "off" && state.tide) {
    const tide = zone.tide?.[state.tide];
    if (tide) {
      emphasis = tide.emphasis;
      notes.push(tide.note);
    }
  }

  if (emphasis !== "off") {
    const load = windLoad(zone, state.wind);
    if (load != null && state.wind) {
      if (load >= 0.55) {
        emphasis = step(emphasis, 1);
        notes.push(
          `The ${state.wind} wind is blowing straight onto this. Bait drifts downwind and the fish that eat it follow — it is the least comfortable bank to fish and usually the right one.`,
        );
      } else if (load <= -0.55) {
        emphasis = step(emphasis, -1);
        notes.push(
          `This is the sheltered side in a ${state.wind} wind. Pleasant to stand on, and the drift has gone to the other bank.`,
        );
      }
    }
  }

  return { zone, emphasis, notes: notes.slice(0, 2) };
}

export function readPlan(schematic: PlanSchematic, level: ReadLevel, state: PlanState): ZoneRead[] {
  return zonesFor(schematic, level).map((zone) => readZone(zone, state));
}

/**
 * One line summarising what the current state did to the picture.
 *
 * A diagram that rearranges itself without saying why is a magic trick. This
 * is the sentence that makes it an explanation.
 */
export function planSummary(reads: ZoneRead[], state: PlanState): string {
  const strong = reads.filter((r) => r.emphasis === "strong");
  const gone = reads.filter((r) => r.emphasis === "off");
  const parts: string[] = [];

  if (strong.length) {
    parts.push(
      `Working hardest right now: ${strong.map((r) => r.zone.label.toLowerCase()).join(", ")}.`,
    );
  }
  if (gone.length) {
    parts.push(`Out of play: ${gone.map((r) => r.zone.label.toLowerCase()).join(", ")}.`);
  }
  if (!parts.length) {
    parts.push(
      "Nothing on this reach is doing anything unusual. That is a normal day, and normal days are read by walking rather than by diagram.",
    );
  }
  if (state.water === "settled" && !state.wind && !state.tide) {
    parts.push("Set a wind, a water state or a tide and the picture will move.");
  }
  return parts.join(" ");
}
