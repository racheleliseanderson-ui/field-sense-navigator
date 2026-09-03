/**
 * What changes when the water changes.
 *
 * `water-reading.ts` answers the standing question: what kind of water is this
 * and what should I look for. It deliberately holds no conditions, and that is
 * correct — it is craft, not observation.
 *
 * This is the other half, and it was the largest thing missing. An angler
 * arriving at water they have read before does not ask "what is a seam". They
 * ask: it rained on Tuesday, what does that do. They ran the dam this morning,
 * where are they now. The wind swung north overnight. The reservoir is twelve
 * feet down. Those are the questions that decide a day, and nothing in the
 * instrument answered any of them.
 *
 * Three rules hold this module honest, and they are the same three the rest of
 * the app lives by:
 *
 *  1. It never claims to know today. Nothing here reads a gauge. Every entry
 *     is "when this happens, this is what it does to water of this class" —
 *     the angler supplies the event, from their own eyes or the agency's page.
 *  2. Every response says what it does NOT change. This is the guard against
 *     the most common failure in fishing advice: one variable moves and
 *     somebody rewrites the whole day around it. Structure does not move
 *     because it rained.
 *  3. Every response says how to confirm it on arrival, and how long it lasts.
 *     A change with no confirmation is a rumour, and a change with no window
 *     gets applied for a fortnight after it stopped being true.
 */

import type { Destination, WaterType } from "@/lib/catalog";
import type { ReadLevel } from "@/lib/water-reading";

export type ConditionEvent =
  | "rain"
  | "falling-clearing"
  | "release"
  | "drawdown"
  | "rising-flooded"
  | "wind-shift"
  | "cold-front"
  | "warm-spell"
  | "turnover"
  | "low-clear"
  | "snowmelt"
  | "tide-change"
  | "wind-against-tide"
  | "freshwater-lens";

export interface ResponseNote {
  id: string;
  /** What physically changes in the water. */
  what: string;
  /** Where that puts fish, or stops them being. */
  where: string;
  /** How to confirm it standing there, before you fish it. */
  confirm: string;
  /** Lowest reader level this is shown at. */
  level: ReadLevel;
}

export interface EventRead {
  event: ConditionEvent;
  /** The reader's own words for it. */
  label: string;
  /** How an angler actually asks the question. */
  question: string;
  applies: WaterType[];
  /** One line: the shape of the whole change. */
  headline: string;
  notes: ResponseNote[];
  /** How long the change lasts, said plainly. */
  window: string;
  /**
   * What this does not change.
   *
   * The most common failure in fishing advice is letting one moving variable
   * rewrite the whole day. Structure does not move because it rained.
   */
  doesNotChange: string;
  /** Lowest reader level the whole event is offered at. */
  level: ReadLevel;
}

const RANK: Record<ReadLevel, number> = { learning: 0, working: 1, advanced: 2 };

/* ------------------------------------------------------------------ *
 * Flowing water
 * ------------------------------------------------------------------ */

const RIVER_EVENTS: EventRead[] = [
  {
    event: "rain",
    label: "It rained, and the river is up",
    question: "What does a rise actually do to where fish are?",
    applies: ["river"],
    headline:
      "A rise is three changes arriving together — more water, less visibility, and a lot more food in it — and they do not all help you.",
    window:
      "The rise itself is the event. It usually peaks within a day of the rain on a small river and takes two to three times as long to fall as it took to come up.",
    doesNotChange:
      "Where the structure is. The rock, the wood and the bend are exactly where they were — they are just under more water and harder to see. Anybody who fished this water low already knows where the good bones are, and a rise is the one time that knowledge is worth the most.",
    level: "learning",
    notes: [
      {
        id: "edges",
        what: "The main current gets too fast to hold in, and the water fills ground that was dry yesterday.",
        where:
          "Out of the middle and onto the edges. Inside bends, slack behind anything solid, the flooded grass along the bank, and the soft seam a foot off the fast water. A fish sitting in heavy current on a rise is spending more than it is earning.",
        confirm:
          "Watch a stick float past. If it is moving faster than you would walk, the middle is not a lie you want to fish.",
        level: "learning",
      },
      {
        id: "food",
        what: "Rain washes worms, terrestrials and everything living in the bank into the water.",
        where:
          "Anywhere that collects drifting food: the head of a slack, the inside of a seam, the tail of a flooded bush. Fish move to the delivery, not to the shelter.",
        confirm:
          "Look at what is actually floating past you for thirty seconds. On a real rise you can usually see it.",
        level: "learning",
      },
      {
        id: "colour",
        what: "Visibility drops, sometimes to inches.",
        where:
          "Closer. A fish that cannot see far has to be near the thing it eats, which means shorter casts and slower work than the same water clear.",
        confirm:
          "Put your rod tip in and watch where it disappears. That distance is roughly how far a fish can find something.",
        level: "working",
      },
      {
        id: "tributary",
        what: "Small tributaries clear before the main river does, and they run colder.",
        where:
          "The mouth, and the strip of clearer water below it. It is the most reliable feature on a dirty river and the first place worth walking to.",
        confirm:
          "Two different colours of water meeting, with a visible line between them.",
        level: "working",
      },
      {
        id: "cold-shock",
        what: "A summer rise on a warm river can drop the temperature several degrees in hours.",
        where:
          "Whatever the temperature drop suits. Sometimes that switches a slow warm-water day on. Sometimes it shuts a cold-water fishery down for a day. It is worth measuring rather than assuming.",
        confirm: "A thermometer, before and during. There is no visual substitute for this one.",
        level: "advanced",
      },
    ],
  },
  {
    event: "falling-clearing",
    label: "The river is dropping and clearing",
    question: "It came up and now it is going down — is this better or worse?",
    applies: ["river"],
    headline:
      "The drop is usually better fishing than the rise, and the window is short, which is why people miss it.",
    window:
      "From the moment the level starts falling until it settles at normal. On most rivers that is one to three days, and the best of it is the first half.",
    doesNotChange:
      "The fish are still the same fish. They have not been replaced by hungrier ones — they have simply had a hard few days and the water has stopped fighting them.",
    level: "learning",
    notes: [
      {
        id: "back-out",
        what: "Fish that pushed to the edges start moving back toward normal lies as the push eases.",
        where:
          "Halfway. The seam that was too fast yesterday is right today, and the flooded grass that was right yesterday is draining. Fish the water between where they were and where they normally live.",
        confirm:
          "A wet line on the bank above the current level tells you how far it has already dropped and how fast.",
        level: "learning",
      },
      {
        id: "clarity-window",
        what: "Colour clears from the top down and from the tributaries outward.",
        where:
          "The clearing edge. Two feet of visibility on a river that had two inches is the best it has been all week, and it will keep improving past the point where the fish stop being easy.",
        confirm: "The rod-tip test again, twice, an hour apart. The direction matters more than the number.",
        level: "working",
      },
      {
        id: "stranded",
        what: "Food that came in on the rise is still in the system, now in clearing water.",
        where:
          "Everywhere the current sorts it — foam lines, eddies, the inside of every bend.",
        confirm: "Foam is not dirt. A foam line is the surface telling you where things collect.",
        level: "working",
      },
    ],
  },
  {
    event: "release",
    label: "They ran the dam",
    question: "The tailwater came up with no rain. What is different about that?",
    applies: ["river", "reservoir"],
    headline:
      "A release is not a flood. It arrives as a surge of clear, usually cold water on a schedule somebody published, and it moves fish before it changes how anything looks.",
    window:
      "As long as generation runs, plus the travel time downstream. The surge reaches water miles below the dam hours after it leaves — which is why the level can rise on a bluebird day with no cloud in sight.",
    doesNotChange:
      "Clarity, usually. This is the difference that catches people out: a tailwater can double in volume and still look like gin, so the visual cue an angler relies on for a rain rise is simply absent.",
    level: "working",
    notes: [
      {
        id: "wading",
        what: "The level comes up faster than a person walks, and it comes up behind you as well as in front.",
        where:
          "Out. This is the one entry in this whole module that is a safety matter before it is a fishing matter — know the schedule before you wade a tailwater, and know your way back.",
        confirm:
          "The agency publishes generation. Check it. A horn, a siren or a sudden colour change in the foam is a very late warning.",
        level: "learning",
      },
      {
        id: "temp",
        what: "Water pulled from deep in a reservoir is cold in summer and relatively warm in winter.",
        where:
          "The cold plume runs downstream and warms as it goes. In August that is why trout live below a dam in a state where they otherwise could not, and it is why the fishing changes character a few miles down.",
        confirm: "Measure at the dam and measure again well below it. The difference is the story.",
        level: "working",
      },
      {
        id: "positioning",
        what: "Current turns a slow pool into a river, and fish position like river fish within minutes.",
        where:
          "Behind everything. Seams and current breaks that meant nothing at low flow become the whole game while the water is running.",
        confirm:
          "Watch the surface texture over a known rock. It appears when the release arrives, and it goes flat again afterwards.",
        level: "working",
      },
      {
        id: "shutoff",
        what: "The end of a release is its own event.",
        where:
          "Falling. Fish that moved out to feed in current get caught by the drop and slide back toward depth, often feeding hard on the way.",
        confirm: "The level dropping while the sky has done nothing at all.",
        level: "advanced",
      },
    ],
  },
  {
    event: "low-clear",
    label: "Low and clear",
    question: "There is no water and I can see every stone. What now?",
    applies: ["river"],
    headline:
      "Low water does not remove fish, it concentrates them — and it removes almost all of your margin for being seen.",
    window: "Until it rains. Which on some rivers is a season.",
    doesNotChange:
      "How many fish the river holds, at least not immediately. They are in less of it, which is a different problem from there being fewer.",
    level: "learning",
    notes: [
      {
        id: "depth",
        what: "The only water deep enough to be safe is the deep water.",
        where:
          "Pools, undercuts, anything with overhead cover, and the tail of a riffle where oxygen and cover overlap. Everything between those is a corridor rather than a home.",
        confirm: "You can see the bottom of most of the river. The bits you cannot are the answer.",
        level: "learning",
      },
      {
        id: "approach",
        what: "Every fish can see you, and low water is quiet enough that they can hear you.",
        where:
          "Behind them, and further back than feels necessary. Approach becomes more important than presentation, which is a reversal most anglers resist for years.",
        confirm:
          "If fish are bolting upstream ahead of you as you walk, you have already lost that pool.",
        level: "learning",
      },
      {
        id: "oxygen",
        what: "Low and warm together is the real problem — warm water holds less oxygen and low water warms faster.",
        where:
          "Riffles, springs, shade and tributary mouths. Fish will crowd into moving water for oxygen alone, entirely apart from food.",
        confirm:
          "Fish stacked somewhere that has no food advantage is usually an oxygen answer.",
        level: "working",
      },
      {
        id: "ethics",
        what: "Warm low water is where a released fish is most likely to die anyway.",
        where:
          "Somewhere else, or earlier in the day. This is the point at which the honest answer to 'where should I fish' is 'not here, this afternoon'.",
        confirm:
          "A thermometer. Most cold-water fisheries have a published number where the agency asks people to stop; look it up for this water rather than trusting a general figure.",
        level: "learning",
      },
    ],
  },
  {
    event: "snowmelt",
    label: "Snowmelt",
    question: "The river is high, cold and the colour of milk.",
    applies: ["river"],
    headline:
      "Melt looks like a rain rise and behaves like a refrigerator. Volume without warmth, and it runs on the sun rather than the weather.",
    window:
      "Weeks, with a daily rhythm: lowest and clearest in the morning, highest and dirtiest in the late afternoon after a warm day.",
    doesNotChange:
      "The calendar. A warm week in March can produce melt conditions that a cold week in May does not — the date on its own tells you very little.",
    level: "working",
    notes: [
      {
        id: "morning",
        what: "Melt is driven by daytime sun, and the water arrives hours later.",
        where:
          "Fish early. First light on a melt river is a different river from the one you left at five the previous afternoon.",
        confirm:
          "Two readings a day at the same spot. If the afternoon is consistently higher and dirtier, you are fishing melt rather than rain.",
        level: "working",
      },
      {
        id: "cold",
        what: "Water in the thirties and low forties slows everything a cold-water fish does.",
        where:
          "Slow and deep, and close to the bottom. A presentation that works in June is simply moving too fast to be taken.",
        confirm: "The thermometer, again. Melt is the one condition where the number is the whole answer.",
        level: "working",
      },
      {
        id: "tribs",
        what: "Not every tributary melts at once — aspect and elevation decide.",
        where:
          "A south-facing drainage melts out before a north-facing one at the same height. Two tributaries a mile apart can be in completely different conditions.",
        confirm: "Look up at where the water is coming from. Snow on one side and bare rock on the other.",
        level: "advanced",
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Stillwater — lakes and ponds
 * ------------------------------------------------------------------ */

const LAKE_EVENTS: EventRead[] = [
  {
    event: "wind-shift",
    label: "The wind changed direction",
    question: "Which bank is worth walking to now?",
    applies: ["lake", "reservoir"],
    headline:
      "Wind is the closest thing a lake has to current, and it stacks the food end of the system against one shore.",
    window:
      "It builds over hours rather than minutes. A shore that has had wind on it all day is a different proposition from one the wind arrived at twenty minutes ago.",
    doesNotChange:
      "The bottom. A windward point is worth fishing because the wind is on it, not because the wind rearranged the structure — and when the wind swings, that point goes back to being ordinary.",
    level: "learning",
    notes: [
      {
        id: "downwind",
        what: "Surface water is pushed downwind, taking plankton and anything drifting in it.",
        where:
          "The shore the wind is blowing into. Bait follows the drift, and the fish that eat bait follow the bait. It is the least comfortable bank to fish and usually the right one.",
        confirm:
          "Foam, floating debris and a slight colour change collecting against one shore. That line is the delivery.",
        level: "learning",
      },
      {
        id: "chop",
        what: "Chop breaks up the surface and takes the edge off the light.",
        where:
          "Shallower than you would fish it flat calm. Fish that will not come up in glass will come up under a ripple, which is why a slick calm day can be harder than a rough one.",
        confirm: "You can no longer see the bottom in water you could see it in this morning.",
        level: "learning",
      },
      {
        id: "fetch",
        what: "How far the wind has run over open water decides how much it has done.",
        where:
          "The end of the longest open stretch. Two miles of fetch onto a point does real work; two hundred yards into a sheltered arm does almost none.",
        confirm:
          "Stand at the spot and look upwind. The amount of open water you can see is the fetch, and it is the whole difference between a windy bank and a working one.",
        level: "working",
      },
      {
        id: "mud-line",
        what: "Sustained wind on a shallow shore stirs the bottom into a band of coloured water.",
        where:
          "The edge of it. A mud line gives cover to fish that would not otherwise use shallow water in daylight, and the clean side of the edge is where they can see out.",
        confirm: "A visible boundary between stirred and clean water, parallel to the shore.",
        level: "working",
      },
      {
        id: "swing",
        what: "When the wind swings, the stacked water relaxes and the whole arrangement unwinds.",
        where:
          "Give it time. A shore that has been windward for a day does not stop being good the instant the wind turns, and the new windward shore takes hours to become anything.",
        confirm: "The foam line breaking up and drifting off the bank.",
        level: "advanced",
      },
    ],
  },
  {
    event: "cold-front",
    label: "A front came through",
    question: "Bright, cold, still, and nothing is happening. Why?",
    applies: ["lake", "reservoir", "river", "marine"],
    headline:
      "The day after a front is the hardest day on most stillwater, and the reason is light and stability rather than temperature.",
    window:
      "Roughly the first day behind the front, easing over the second and third as the system settles.",
    doesNotChange:
      "Where the fish are, mostly. Post-front fish are usually in the same places doing less, not somewhere else doing something different. Hunting for a new spot is the standard mistake.",
    level: "learning",
    notes: [
      {
        id: "tight",
        what: "Fish pull tight to cover and stop moving to eat.",
        where:
          "Inside the cover rather than beside it. The distance you have to put a presentation to a post-front fish is measured in inches rather than feet.",
        confirm:
          "Hard blue sky, flat water, and a noticeably cold morning after a warm one.",
        level: "learning",
      },
      {
        id: "slow",
        what: "The window a fish will commit in gets much shorter.",
        where:
          "Same water, slower, with longer pauses. This is a presentation change rather than a location change, and it is the one that actually rescues the day.",
        confirm:
          "Follows that turn away. A fish that comes and looks has found it and rejected the speed.",
        level: "learning",
      },
      {
        id: "deeper",
        what: "Bright light with no chop pushes fish off shallow flats.",
        where:
          "The first depth change out from where they were. Not the deepest water in the lake — the nearest edge.",
        confirm: "You can see the bottom in six feet of water. So can everything else.",
        level: "working",
      },
    ],
  },
  {
    event: "turnover",
    label: "Turnover",
    question: "The lake smells odd and nothing is where it was.",
    applies: ["lake", "reservoir"],
    headline:
      "In autumn the surface cools until the whole column is the same temperature and mixes top to bottom. For a week or two the lake stops having layers, and everything that depended on them moves.",
    window:
      "A week or two, then it settles into a mixed lake and the fishing comes back — often better than before.",
    doesNotChange:
      "The structure, and the fish's need to eat. Turnover is temporary chaos in the water column, not a change in the lake's geography.",
    level: "working",
    notes: [
      {
        id: "signs",
        what: "Debris from the bottom comes up: bits of weed, a brown tinge, and a distinct smell.",
        where:
          "Not much use anywhere until it settles. This is one of the few honest 'go somewhere else' answers in fishing.",
        confirm:
          "Suspended particles in water that was clear a week ago, and a surface temperature within a degree or two of the bottom.",
        level: "working",
      },
      {
        id: "shallow",
        what: "The shallows and the inflows are the last places to be affected and the first to settle.",
        where:
          "Skinny water, creek arms, anywhere fed by something. If you fish a lake in turnover, fish the parts that are not really lake.",
        confirm: "Clearer water up a creek arm than out in the main body.",
        level: "working",
      },
      {
        id: "after",
        what: "Once it settles, the whole column is available and oxygenated.",
        where:
          "Deeper than in summer, and no longer bounded by a thermocline. Autumn after turnover is when a lot of lakes fish at their best.",
        confirm: "The water clears and the smell goes.",
        level: "advanced",
      },
    ],
  },
  {
    event: "warm-spell",
    label: "A run of warm, still days",
    question: "It has been hot and calm for a week. Where did they go?",
    applies: ["lake", "reservoir"],
    headline:
      "Sustained heat and no wind builds layers: warm on top, cold below, and a band in the middle where the temperature falls away quickly.",
    window:
      "It builds over weeks and holds until the weather breaks it or autumn does.",
    doesNotChange:
      "That fish still have to eat. A stratified lake is not an empty one, it is a smaller one — the usable part has a ceiling and a floor.",
    level: "working",
    notes: [
      {
        id: "layer",
        what: "Below the thermocline the water is cold and, by late summer, often short of oxygen.",
        where:
          "Above it. In a stratified lake, the deep water that looks like refuge is frequently the one place a fish cannot be.",
        confirm:
          "Lower a thermometer at intervals. The depth where it falls several degrees over a couple of feet is the line.",
        level: "working",
      },
      {
        id: "night",
        what: "Shallow water is usable at night and around first light, and not much use at noon.",
        where:
          "Early, late, and shaded. Timing does more here than location.",
        confirm: "Surface activity at dawn that has stopped by mid-morning.",
        level: "learning",
      },
      {
        id: "springs",
        what: "Cold inflows and springs create small pockets of livable water.",
        where:
          "Creek mouths and anywhere the bank is unusually green. These are small, and they can be crowded.",
        confirm: "A thermometer at the surface near an inflow, against one out in open water.",
        level: "advanced",
      },
    ],
  },
  {
    event: "rain",
    label: "Heavy rain on the lake",
    question: "Does rain do anything to a lake?",
    applies: ["lake", "reservoir"],
    headline:
      "Less than it does to a river, and almost all of what it does happens where water comes in.",
    window: "During, and for a day or two after while the inflows run.",
    doesNotChange:
      "The main lake, mostly. A big lake absorbs a lot of rain without noticing. The action is at the edges.",
    level: "learning",
    notes: [
      {
        id: "inflow",
        what: "Creeks run, bringing colour, food and current into still water.",
        where:
          "The mouth and the plume below it. Current in a lake is rare enough that fish use it when it appears.",
        confirm: "A visible colour plume spreading from a creek mouth.",
        level: "learning",
      },
      {
        id: "runoff",
        what: "Bank runoff washes terrestrials and soil into the margins.",
        where: "Steep shorelines, culverts, road drainage, and anywhere water is visibly entering.",
        confirm: "You can hear it before you see it.",
        level: "working",
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Reservoirs — a lake with a tap on it
 * ------------------------------------------------------------------ */

const RESERVOIR_EVENTS: EventRead[] = [
  {
    event: "drawdown",
    label: "The reservoir is well down",
    question: "It is twenty feet low and the ramp is a mudflat. Where does that leave fish?",
    applies: ["reservoir"],
    headline:
      "A drawdown does not just remove water from the top, it removes the shallow shelf that most of the cover was on — and pushes everything toward the old river channel the reservoir was built over.",
    window:
      "Seasonal and managed. Many reservoirs are drawn down through autumn and refilled in spring, on a schedule the operating agency publishes.",
    doesNotChange:
      "The channel. Every reservoir has a drowned river in it, and it is in the same place at every level. When water is short, that channel is the one feature that still means something.",
    level: "learning",
    notes: [
      {
        id: "channel",
        what: "The old river bed becomes the deepest, most stable water available.",
        where:
          "On and along the channel edge, and at the junctions where a creek channel meets the main one. Junctions concentrate fish at low water more reliably than anything else in the lake.",
        confirm:
          "Low water is when you can see the channel from the bank. Walk the exposed flat and look at where it drops away — then remember it for when the lake is full.",
        level: "learning",
      },
      {
        id: "exposed",
        what: "Structure that has been underwater for years is briefly visible.",
        where:
          "Nowhere, right now — it is dry. But this is the single best opportunity a reservoir angler gets, and it lasts weeks. Walk it, photograph it, remember it.",
        confirm: "Stumps, rock piles, old roadbeds, foundations, culverts. All of it is fishable water at full pool.",
        level: "learning",
      },
      {
        id: "cover-loss",
        what: "The bank cover fish were using is high and dry.",
        where:
          "Deeper, and on hard structure rather than wood. A drawn-down reservoir is a rock and channel fishery even where a full one is a timber fishery.",
        confirm: "A visible bathtub ring, and the treeline well above the waterline.",
        level: "working",
      },
      {
        id: "ramps",
        what: "Access closes before the fishing does.",
        where:
          "Check the ramp before you tow anything. Low water is where a published access point and a usable one stop being the same thing.",
        confirm: "The agency's own page for this water, on the day you go.",
        level: "learning",
      },
    ],
  },
  {
    event: "rising-flooded",
    label: "The reservoir is filling",
    question: "It came up ten feet and there are bushes in the water.",
    applies: ["reservoir", "lake"],
    headline:
      "Rising water floods ground that has been growing things all year, and fish move into it almost immediately.",
    window:
      "While it is rising and for a while after it stabilises. A falling level empties that cover much faster than a rising one filled it.",
    doesNotChange:
      "The channel is still down there. Fish using flooded cover are visitors — the deep structure is still the address they go home to.",
    level: "learning",
    notes: [
      {
        id: "newly-flooded",
        what: "Freshly flooded bank holds terrestrials, worms and cover all at once.",
        where:
          "The newest water. Not the middle of the flooded timber — the outer edge that went under most recently.",
        confirm:
          "Green grass and leaves still on the flooded bushes. Once it is brown, the water has been there a while and so has everything that lives in it.",
        level: "learning",
      },
      {
        id: "colour",
        what: "Rising water is usually stained where it is climbing the bank.",
        where:
          "Shallower than you would expect for the time of year, because the colour is cover.",
        confirm: "Colour that is worst at the margins and clears as you move out.",
        level: "working",
      },
      {
        id: "falling-trap",
        what: "When the level drops again, fish leave flooded cover fast.",
        where:
          "The first drop-off outside it. A falling reservoir moves fish out much quicker than a rising one moved them in, and fishing yesterday's flooded bush is the standard error.",
        confirm: "A wet, dark band of bank above the current waterline.",
        level: "working",
      },
    ],
  },
  {
    event: "release",
    label: "They are generating",
    question: "There is current in the lake. What does that do?",
    applies: ["reservoir"],
    headline:
      "Pulling water through a dam creates current in still water, and fish in the lower lake respond to it the way river fish respond to flow.",
    window: "While generation runs, which the operating agency publishes by the hour.",
    doesNotChange:
      "The upper end of the lake, generally. Current from generation is felt near the dam and along the channel, and much less in the creek arms.",
    level: "working",
    notes: [
      {
        id: "channel-flow",
        what: "Water moves along the old channel toward the dam.",
        where:
          "On the channel edge, facing the flow. Points and humps along that path suddenly behave like river structure.",
        confirm: "Debris or foam drifting steadily in one direction on an otherwise still lake.",
        level: "working",
      },
      {
        id: "bait",
        what: "Current moves bait, and moving bait is easier to eat.",
        where:
          "The downstream side of anything that breaks flow. This is the same reading as a river, applied to a lake.",
        confirm: "Surface activity that starts when generation starts and stops when it stops.",
        level: "working",
      },
      {
        id: "schedule",
        what: "Generation is a schedule, not weather.",
        where:
          "Plan around it. This is one of the few things in fishing you can genuinely know in advance, and most people never look it up.",
        confirm: "The operating agency's generation schedule for this dam.",
        level: "advanced",
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Marine
 * ------------------------------------------------------------------ */

const MARINE_EVENTS: EventRead[] = [
  {
    event: "tide-change",
    label: "The tide turned",
    question: "Does it matter which way the water is going?",
    applies: ["marine"],
    headline:
      "Moving water is the whole event. Which direction matters less than whether it is moving at all, and the change is usually better than either end of it.",
    window:
      "The hours either side of the turn on most marks, and the slack itself is generally the worst of it.",
    doesNotChange:
      "The structure, and the depth of it. A bar is a bar at every state of tide — the tide changes how water crosses it and how much of it there is.",
    level: "learning",
    notes: [
      {
        id: "moving",
        what: "Current carries food past ambush points and puts fish on station.",
        where:
          "The down-current side of anything solid, and in the funnel where water has to squeeze. Slack water is when to move, eat lunch or rig up.",
        confirm:
          "Watch weed or foam against a piling. When it stops moving, you are in slack.",
        level: "learning",
      },
      {
        id: "drain",
        what: "A falling tide drains flats and creeks, forcing everything that was up there out through the drains.",
        where:
          "The mouth of the drain, on the outside, facing in. It is the single most reliable arrangement in inshore fishing.",
        confirm: "Water visibly leaving a flat through a defined channel.",
        level: "learning",
      },
      {
        id: "flood-flats",
        what: "A rising tide gives access to ground that has been dry.",
        where:
          "Up on the flat, following the edge in. Fish push onto new ground with the water and are often the shallowest they will be all day.",
        confirm: "Wakes and pushes in water too shallow to hide anything.",
        level: "working",
      },
      {
        id: "stage",
        what: "The same mark fishes differently at different stages, and one stage is usually much better.",
        where:
          "Wherever your own notes say. This is the reading that rewards a record more than almost anything else in fishing — a mark plus a tide stage is a real pattern.",
        confirm: "A tide table, and writing down which stage you actually fished.",
        level: "advanced",
      },
    ],
  },
  {
    event: "wind-against-tide",
    label: "Wind against tide",
    question: "It has gone lumpy and short. Is that just uncomfortable, or does it matter?",
    applies: ["marine"],
    headline:
      "Wind pushing one way over water moving the other stands the sea up into a short steep chop, and it changes both the fishing and whether you should be out in it.",
    window: "Until one of the two changes — usually the tide.",
    doesNotChange:
      "The fish's interest in current. The tide is still doing what it does underneath; what has changed is the surface and your ability to work over it.",
    level: "working",
    notes: [
      {
        id: "sea-state",
        what: "The wave interval shortens and the faces steepen.",
        where:
          "Somewhere sheltered, often. This is a safety judgement in a small boat before it is a fishing one, and it can build fast.",
        confirm: "Whitecaps appearing in a place that was rolling half an hour ago.",
        level: "learning",
      },
      {
        id: "presentation",
        what: "Boat control and line control both get much harder.",
        where:
          "Heavier, tighter, shorter. Anything relying on a controlled drift becomes hard work in the same water where it was easy on a fair wind.",
        confirm: "The line bellying downwind faster than the drift can take up.",
        level: "working",
      },
      {
        id: "structure",
        what: "Standing water over a bar or a rip becomes dramatically rougher than the water either side.",
        where:
          "The edges of it. The rip itself may be unfishable while the water twenty yards off it is excellent.",
        confirm: "A defined line of broken water where it was smooth on the last tide.",
        level: "working",
      },
    ],
  },
  {
    event: "freshwater-lens",
    label: "Rain on an estuary",
    question: "It rained upriver. Why is the fishing different at the coast?",
    applies: ["marine"],
    headline:
      "Fresh water floats on salt. After rain, an estuary can have a warm, dirty freshwater layer sitting on top of the salt water fish are actually using.",
    window: "While the river is running high, plus the time it takes to flush on the tides.",
    doesNotChange:
      "The salt underneath. The layer is a lid, not a replacement — which is exactly why fishing under it works when fishing in it does not.",
    level: "working",
    notes: [
      {
        id: "under",
        what: "The two layers do not mix quickly, and they can differ by several degrees and a lot of salinity.",
        where:
          "Below the boundary. Getting a presentation through the fresh layer and into the salt is often the whole adjustment.",
        confirm:
          "A visible colour line, or a thermometer that changes sharply a few feet down.",
        level: "working",
      },
      {
        id: "edge",
        what: "The line where dirty fresh water meets clean salt is an edge like any other.",
        where: "Along it, on the clean side.",
        confirm: "A colour boundary you can see from the boat or the bank, often with foam on it.",
        level: "working",
      },
      {
        id: "food",
        what: "River flooding delivers food into the top of the system.",
        where:
          "Where the flow slows and drops it — the inside of the first bend, the back of a bar, any eddy in the estuary.",
        confirm: "Debris collecting in a predictable place.",
        level: "advanced",
      },
    ],
  },
  {
    event: "cold-front",
    label: "A front came through",
    question: "Cold, bright and blown out. What changed inshore?",
    applies: ["marine"],
    headline:
      "On shallow inshore ground a front does what it does on a lake, and more sharply, because there is less water to buffer it.",
    window: "A day or two, and less where the tide is strong enough to mix it.",
    doesNotChange:
      "The tide. Whatever a front does, the water is still going to move, and that remains the most useful thing about the day.",
    level: "learning",
    notes: [
      {
        id: "flats",
        what: "Shallow flats lose several degrees fast and fish leave them.",
        where:
          "The nearest deeper water — a channel edge, a hole, a basin. Often only a few hundred yards from where they were.",
        confirm: "A surface temperature well down on the day before, on the same flat.",
        level: "learning",
      },
      {
        id: "return",
        what: "They come back as the shallows warm, and the shallows warm from the sun.",
        where:
          "Dark bottom, out of the wind, in the afternoon. Timing rather than location again.",
        confirm: "Warmer water over dark mud than over light sand, in the same depth.",
        level: "working",
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Selection
 * ------------------------------------------------------------------ */

const BY_CLASS: Record<WaterType, EventRead[]> = {
  river: RIVER_EVENTS,
  lake: LAKE_EVENTS,
  reservoir: [...RESERVOIR_EVENTS, ...LAKE_EVENTS.filter((e) => e.applies.includes("reservoir"))],
  marine: MARINE_EVENTS,
};

/**
 * The changes worth understanding on this class of water, at this level.
 *
 * Notes are filtered by level as well as events, so a Learning reader gets the
 * three that decide most days rather than a shorter list of the same density.
 */
export function eventsFor(waterClass: WaterType, level: ReadLevel): EventRead[] {
  return BY_CLASS[waterClass]
    .filter((e) => RANK[e.level] <= RANK[level])
    .map((e) => ({ ...e, notes: e.notes.filter((n) => RANK[n.level] <= RANK[level]) }))
    .filter((e) => e.notes.length > 0);
}

/**
 * Events this particular record has a specific reason to care about.
 *
 * Deliberately narrow. A reservoir has releases and drawdowns because it is a
 * reservoir, and a record managed by a water or power agency is more likely to
 * be run on a published schedule — that is as far as the data honestly goes.
 * Everything else is offered as craft for the class, not as a claim about this
 * water.
 */
export function sharpenedFor(d: Destination): ConditionEvent[] {
  const out = new Set<ConditionEvent>();
  if (d.waterType === "reservoir") {
    out.add("drawdown");
    out.add("release");
    out.add("rising-flooded");
  }
  const agency = (d.managingAgency ?? "").toLowerCase();
  const tags = (d.tags ?? []).join(" ").toLowerCase();
  if (/reclamation|usbr|corps|usace|power|hydro|water district/.test(`${agency} ${tags}`)) {
    out.add("release");
    out.add("drawdown");
  }
  if (d.waterType === "marine") out.add("tide-change");
  return [...out];
}

/** Every event in the library, for the reference index. Order is stable. */
export function allEvents(): EventRead[] {
  const seen = new Set<string>();
  const out: EventRead[] = [];
  for (const list of [RIVER_EVENTS, LAKE_EVENTS, RESERVOIR_EVENTS, MARINE_EVENTS]) {
    for (const e of list) {
      const key = `${e.event}:${e.applies.join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
  }
  return out;
}
