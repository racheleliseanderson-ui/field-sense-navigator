import { Link } from "@tanstack/react-router";

import { abbrFor, countByState, isProvince, states } from "@/lib/catalog";

/* ------------------------------------------------------------------ *
 * Coverage map
 *
 * A schematic tile grid of North America — one square per state, province
 * and territory, sized by nothing and shaded by how many named public waters
 * the catalog holds there. It is deliberately NOT a pin map: geography is
 * given as jurisdiction and neighbourhood, which is the resolution a decision
 * is actually made at. A named public water does carry a coarse location —
 * three decimal places, about 100 m, enough for a gridpoint lookup and to say
 * which basin it is. Fishing spots, access detail and private water never
 * enter the catalog at all, which is the line that actually matters.
 * ------------------------------------------------------------------ */

/** [column, row] on a 12-wide grid. Canada occupies the first two rows. */
const TILES: Record<string, [number, number]> = {
  // Canada
  Yukon: [1, 0],
  "Northwest Territories": [2, 0],
  Nunavut: [3, 0],
  "Newfoundland and Labrador": [10, 0],
  "British Columbia": [1, 1],
  Alberta: [2, 1],
  Saskatchewan: [3, 1],
  Manitoba: [4, 1],
  Ontario: [5, 1],
  Quebec: [6, 1],
  "New Brunswick": [7, 1],
  "Prince Edward Island": [8, 1],
  "Nova Scotia": [9, 1],

  // United States
  Alaska: [0, 3],
  Maine: [10, 3],
  Vermont: [9, 4],
  "New Hampshire": [10, 4],
  Washington: [1, 5],
  Idaho: [2, 5],
  Montana: [3, 5],
  "North Dakota": [4, 5],
  Minnesota: [5, 5],
  Illinois: [6, 5],
  Wisconsin: [7, 5],
  Michigan: [8, 5],
  "New York": [9, 5],
  "Rhode Island": [10, 5],
  Massachusetts: [11, 5],
  Oregon: [1, 6],
  Nevada: [2, 6],
  Wyoming: [3, 6],
  "South Dakota": [4, 6],
  Iowa: [5, 6],
  Indiana: [6, 6],
  Ohio: [7, 6],
  Pennsylvania: [8, 6],
  "New Jersey": [9, 6],
  Connecticut: [10, 6],
  California: [1, 7],
  Utah: [2, 7],
  Colorado: [3, 7],
  Nebraska: [4, 7],
  Missouri: [5, 7],
  Kentucky: [6, 7],
  "West Virginia": [7, 7],
  Virginia: [8, 7],
  Maryland: [9, 7],
  Delaware: [10, 7],
  Arizona: [2, 8],
  "New Mexico": [3, 8],
  Kansas: [4, 8],
  Arkansas: [5, 8],
  Tennessee: [6, 8],
  "North Carolina": [7, 8],
  "South Carolina": [8, 8],
  Oklahoma: [4, 9],
  Louisiana: [5, 9],
  Mississippi: [6, 9],
  Alabama: [7, 9],
  Georgia: [8, 9],
  Hawaii: [0, 10],
  Texas: [3, 10],
  Florida: [9, 10],
};

/** Four bands, so density reads without depending on hue alone. */
function band(n: number, max: number): 0 | 1 | 2 | 3 {
  if (n <= 0) return 0;
  const share = n / Math.max(1, max);
  if (share >= 0.6) return 3;
  if (share >= 0.3) return 2;
  return 1;
}

const BAND_CLASS: Record<0 | 1 | 2 | 3, string> = {
  0: "border-hairline bg-transparent text-muted-foreground/60",
  1: "border-brass/30 bg-brass/[0.08] text-foreground/80",
  2: "border-brass/50 bg-brass/[0.18] text-foreground",
  3: "border-brass/80 bg-brass/30 text-foreground",
};

export function CoverageMap({
  activeState = "",
  className = "",
}: {
  /** Highlighted jurisdiction, if the page has one selected. */
  activeState?: string;
  className?: string;
}) {
  const max = Math.max(1, ...[...countByState.values()]);
  const placed = states.filter((s) => TILES[s]);
  const unplaced = states.filter((s) => !TILES[s]);

  return (
    <div className={className}>
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <ul
          className="grid w-max min-w-full gap-1"
          style={{
            gridTemplateColumns: "repeat(12, minmax(2.6rem, 1fr))",
            gridTemplateRows: "repeat(11, minmax(2.6rem, auto))",
          }}
        >
          {placed.map((s) => {
            const [col, row] = TILES[s]!;
            const n = countByState.get(s) ?? 0;
            const active = activeState === s;
            return (
              <li key={s} style={{ gridColumn: col + 1, gridRow: row + 1 }}>
                <Link
                  to="/explore"
                  search={{ state: s, juris: isProvince(s) ? "ca" : "us" }}
                  aria-label={`${s} — ${n} named public water${n === 1 ? "" : "s"}`}
                  aria-current={active ? "true" : undefined}
                  className={`tap flex h-full min-h-[2.6rem] w-full flex-col items-center justify-center border transition-colors hover:border-brass hover:bg-brass/30 ${
                    active ? "outline outline-2 outline-offset-1 outline-brass" : ""
                  } ${BAND_CLASS[band(n, max)]}`}
                >
                  <span className="data text-[0.62rem] font-semibold leading-none">
                    {abbrFor(s)}
                  </span>
                  <span className="data mt-0.5 text-[0.55rem] leading-none opacity-70">{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {unplaced.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {unplaced.map((s) => (
            <li key={s}>
              <Link
                to="/explore"
                search={{ state: s }}
                className="tap inline-flex min-h-9 items-center border border-hairline px-2.5 text-[0.68rem] text-muted-foreground hover:border-brass/50 hover:text-brass"
              >
                {s} · {countByState.get(s) ?? 0}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 max-w-2xl text-[0.68rem] leading-relaxed text-muted-foreground">
        A schematic of jurisdictions, not a chart of positions — one square per state, province and
        territory, carrying the number of named public waters held there. Geography is given at the
        resolution a decision is made at: which jurisdiction governs, and what else is nearby. A named
        public water is located to about a hundred metres, which tells you the basin and nothing about
        where the fish are. Fishing spots, access detail and private water are not in the catalog.
      </p>
    </div>
  );
}
