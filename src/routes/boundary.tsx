import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { Art } from "@/components/art";
import { PLATES } from "@/lib/imagery";
import { withIdentity } from "@/lib/seo";

export const Route = createFileRoute("/boundary")({
  head: () =>
    withIdentity(
      { path: "/boundary" },
      {
        meta: [
          { title: "Limits & sources · Field Sense Navigator" },
          {
            name: "description",
            content:
              "What Field Sense Navigator includes, what it will not hold, and where this guide stops for named public waters.",
          },
          { property: "og:title", content: "Limits & sources · Field Sense Navigator" },
          {
            property: "og:description",
            content:
              "Public waters only. No private spots, no access detail, no live-condition claims. The scope rules behind every record.",
          },
        ],
      },
    ),
  component: BoundaryPage,
});

const IN_SCOPE = [
  "Named public waterbodies and officially published public access facilities.",
  "Notices and advisories that the managing agency has published.",
  "Verification steps you must complete on the day of travel.",
  "Documented seasonal and regulatory pressure points, by section where stated.",
  "The date the official source was last read, and when it is due to be read again.",
];

const OUT_OF_SCOPE = [
  "Private water, leased water, or any spot supplied by a user in confidence.",
  "Exact coordinates, waypoints, or anything that reduces a corridor to a pin.",
  "Live gauge height, discharge, tide stage, wind, water temperature or clarity.",
  "Hatch activity, bite windows, forage timing, or any catch expectation.",
  "Conservation-sensitive locations, spawning concentrations, or vulnerable populations.",
  "Real-time parking, ramp queue, or facility staffing.",
];

/**
 * Attribution and the licence each source carries.
 *
 * USGS, NOAA and the National Weather Service publish as works of the United
 * States government and carry no licence condition. The Water Survey of
 * Canada does: its data is released under the Open Government Licence –
 * Canada, which requires attribution wherever the data is used. Fifty-nine of
 * this catalog's station bindings are WSC, so that attribution is a condition
 * of use, not a courtesy.
 */
const SOURCES: Array<{ agency: string; used: string; licence: string; url: string }> = [
  {
    agency: "U.S. Geological Survey",
    used: "Stage, discharge, water temperature and reservoir elevation.",
    licence: "United States government work — public domain.",
    url: "https://waterdata.usgs.gov/",
  },
  {
    agency: "NOAA Tides & Currents (CO-OPS)",
    used: "Water level, water temperature and wind at coastal stations.",
    licence: "United States government work — public domain.",
    url: "https://tidesandcurrents.noaa.gov/",
  },
  {
    agency: "National Weather Service",
    used: "Station observations and the point forecast for a bound location.",
    licence: "United States government work — public domain.",
    url: "https://www.weather.gov/",
  },
  {
    agency: "Water Survey of Canada",
    used: "Water level and discharge at Canadian stations.",
    licence:
      "Contains information licensed under the Open Government Licence – Canada. Attribution required.",
    url: "https://wateroffice.ec.gc.ca/",
  },
  {
    agency:
      "U.S. Bureau of Reclamation, U.S. Army Corps of Engineers, California Data Exchange Centre",
    used: "Reservoir elevation and storage where those agencies are the operator of record.",
    licence: "Agency-published operational data.",
    url: "https://www.usbr.gov/",
  },
];

const SAFETY = [
  "This is a planning guide, not a safety service and not a substitute for the agency that manages the water. Nothing here is a determination that a water is safe, open, legal or fishable on the day you travel.",
  "Access rights, closures, seasons, limits and gear rules change without notice, and a record is always older than the water it describes. The official source linked on every record governs; posted signage on the day outranks both.",
  "Conditions on water can be dangerous. Current, cold, ice, tide, wind, wildfire smoke and algal advisories are noted where an agency has published them and are absent where it has not — an absence here is silence, never an all-clear.",
  "You are responsible for your own decisions, your own licensing and your own safety. If a check cannot be completed, the answer this guide gives is not ready.",
];

function BoundaryPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="content">
        <section className="relative isolate overflow-hidden border-b border-hairline">
          <Art plate={PLATES.still} scrim="band" opacity={0.8} priority />
          <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 md:py-32">
            <p className="tick text-brass">Limits</p>
            <h1 className="mt-5 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.6rem)] font-bold leading-[0.94] tracking-[-0.04em] text-foreground">
              Limits & sources
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              Everything this guide is willing to say is bounded by what a public agency has already
              published. Where the record runs out, we say so and stop. Stopping there is the point.
              A guide that filled the gap would be easier to read and worse to travel on.
            </p>
          </div>
        </section>

        <section className="mx-auto grid grid-cols-1 max-w-7xl gap-px bg-hairline px-0 sm:mx-auto md:grid-cols-2">
          <div className="bg-background p-8 sm:p-12">
            <p className="tick text-clear">Held on record</p>
            <ul className="mt-6 space-y-5">
              {IN_SCOPE.map((x) => (
                <li key={x} className="flex gap-4">
                  <span className="mt-2.5 h-px w-6 shrink-0 bg-clear" />
                  <span className="text-base leading-relaxed text-foreground">{x}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-abyss p-8 sm:p-12">
            <p className="tick text-alert">Not held, permanently</p>
            <ul className="mt-6 space-y-5">
              {OUT_OF_SCOPE.map((x) => (
                <li key={x} className="flex gap-4">
                  <span className="mt-2.5 h-px w-6 shrink-0 bg-alert" />
                  <span className="text-base leading-relaxed text-muted-foreground">{x}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="font-display text-[clamp(1.8rem,3.6vw,3rem)] font-bold leading-[1] tracking-[-0.035em] text-foreground">
                Where this guide stops.
              </h2>
            </div>
            <div className="space-y-6 text-base leading-relaxed text-muted-foreground">
              <p>
                A water is only ready when every same-day check has been completed by the person
                travelling. If a check cannot be completed — the phone rings out, the page is down,
                the sign is missing — the default answer is not ready. This guide never fills that
                gap with a guess.
              </p>
              <p>
                Confidence figures describe how well documented a layer is, not how likely a day is
                to go well. They never reach 100, because the record is always older than the water.
              </p>
              <p>
                Posted signage and the managing authority outrank anything printed from this guide,
                including a brief you carried in your pocket.
              </p>
              <Link
                to="/plan"
                className="inline-flex items-center gap-3 border border-brass/50 bg-brass/10 px-6 py-3 text-sm font-medium text-brass transition-colors hover:bg-brass/20"
              >
                Plan a day within these limits
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="limits-heading" className="border-t border-hairline bg-abyss">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
            <p className="tick text-alert">Read this before you rely on it</p>
            <h2
              id="limits-heading"
              className="mt-5 max-w-3xl font-display text-[clamp(1.8rem,3.6vw,3rem)] font-bold leading-[1] tracking-[-0.035em] text-foreground"
            >
              What this guide is not.
            </h2>
            <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              {SAFETY.map((line) => (
                <li key={line} className="flex gap-4">
                  <span className="mt-2.5 h-px w-6 shrink-0 bg-alert" />
                  <span className="text-base leading-relaxed text-muted-foreground">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="sources-heading" className="border-t border-hairline">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
            <p className="tick text-brass">Sources and licence</p>
            <h2
              id="sources-heading"
              className="mt-5 max-w-3xl font-display text-[clamp(1.8rem,3.6vw,3rem)] font-bold leading-[1] tracking-[-0.035em] text-foreground"
            >
              Whose readings these are.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Every observation in this instrument is an agency's, published by the agency, and
              reproduced with its own timestamp. None of it is modelled, interpolated or estimated
              here.
            </p>
            <dl className="mt-10 grid grid-cols-1 gap-px bg-hairline md:grid-cols-2">
              {SOURCES.map((s) => (
                <div key={s.agency} className="bg-background p-6">
                  <dt className="font-display text-base font-bold tracking-tight text-foreground">
                    <a href={s.url} className="hover:text-brass" rel="noreferrer">
                      {s.agency}
                    </a>
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.used}</dd>
                  <dd className="mt-2 text-[0.72rem] leading-relaxed text-dim-foreground">
                    {s.licence}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
