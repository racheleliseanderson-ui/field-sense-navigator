import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { WaterCard } from "@/components/water-card";
import { destinations, states } from "@/lib/catalog";
import { readiness } from "@/lib/intelligence";
import heroImg from "@/assets/hero-water.jpg";
import riverImg from "@/assets/river.jpg";
import flatsImg from "@/assets/flats.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Honey Hole Intelligence · Public-Waters Field Instrument" },
      {
        name: "description",
        content:
          "A layered field intelligence instrument for 318 named public waters: access, hazards, capacity, regulatory pressure and same-day field checks. No private spots.",
      },
      { property: "og:title", content: "Honey Hole Intelligence · Public-Waters Field Instrument" },
      {
        property: "og:description",
        content:
          "Declare the job, rank the waters that actually fit, print a field packet. Public waters only, fail-closed by design.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const REFUSALS = [
  "Live gauge height or flow",
  "Today's wind at the ramp",
  "Hatch or bite windows",
  "Any catch guarantee",
  "Private or user-supplied spots",
  "Exact coordinates",
];

function Home() {
  const featured = [...destinations]
    .map((d) => ({ d, r: readiness(d) }))
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 3);

  const constrained = [...destinations]
    .map((d) => ({ d, r: readiness(d) }))
    .sort((a, b) => a.r.score - b.r.score)[0];

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="content">

      {/* ---------- HERO: the instrument face ---------- */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroImg}
          alt="Dark wind-scoured open water at first light beneath a slate storm band"
          width={1920}
          height={1088}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-abyss/85 via-abyss/60 to-background" />
        <div className="hairline-grid absolute inset-0 -z-10 opacity-25" />

        <div className="mx-auto max-w-7xl px-5 pb-16 pt-24 sm:px-8 md:pb-24 md:pt-36">
          <div className="flex items-center gap-4">
            <span className="h-px w-12 bg-brass" />
            <p className="tick text-brass">Hook the Horizon · Schema 0.4.0</p>
          </div>

          <h1 className="rise mt-8 max-w-5xl font-display text-[clamp(2.8rem,8.4vw,7.2rem)] font-bold uppercase leading-[0.86] tracking-[-0.045em] text-foreground">
            Read the water
            <br />
            <span className="text-brass">before</span> you drive to it.
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-relaxed text-foreground/80">
            Five intelligence layers over {destinations.length} named public
            waters. Declare the job you are actually doing, and the instrument
            ranks the water that fits it — then prints the same-day checks you
            have to clear before you go.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/plan"
              className="group inline-flex items-center gap-4 bg-brass px-7 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-accent-foreground transition-transform hover:-translate-y-0.5"
            >
              Plan a day
              <span className="h-px w-8 bg-accent-foreground/60 transition-all group-hover:w-12" />
            </Link>
            <Link
              to="/explore"
              className="inline-flex items-center gap-3 border border-hairline bg-abyss/50 px-7 py-4 text-sm font-medium uppercase tracking-[0.14em] text-foreground backdrop-blur transition-colors hover:border-brass/50"
            >
              Browse the catalog
            </Link>
          </div>
        </div>

        {/* readout strip */}
        <div className="relative border-y border-hairline bg-abyss/70 backdrop-blur">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-hairline sm:px-0 md:grid-cols-4">
            {[
              { k: "Named waters", v: destinations.length },
              { k: "States", v: states.length },
              { k: "Intelligence layers", v: 5 },
              { k: "Private spots", v: 0 },
            ].map((s) => (
              <div key={s.k} className="px-5 py-7 sm:px-8">
                <dt className="tick text-[0.55rem]">{s.k}</dt>
                <dd className="data mt-2 text-3xl font-semibold text-foreground">
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- THE LAYERS: dark editorial band ---------- */}
      <section className="relative overflow-hidden bg-abyss">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 md:py-32">
          <div className="grid gap-14 md:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="tick text-brass">The stack</p>
              <h2 className="mt-5 font-display text-[clamp(2rem,4.4vw,3.6rem)] font-bold leading-[0.95] tracking-[-0.04em] text-foreground">
                Five layers,
                <br />
                each one honest
                <br />
                about its edge.
              </h2>
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Every layer carries a confidence figure and a list of what it
                still cannot see. Nothing is inferred to fill a gap.
              </p>
            </div>

            <ol className="divide-y divide-hairline border-y border-hairline">
              {[
                ["01", "Access & legality", "Published facilities, closures, directory-level networks, and the line where public corridor ends."],
                ["02", "Conditions & hazards", "Standing hazard families the water is known for — wind fetch, tide, level swing, traffic. Never a forecast."],
                ["03", "Capacity & crowding", "Documented pressure on parking, ramps and hours. Patterns, never live occupancy."],
                ["04", "Seasonal & regulatory pressure", "Where rules move with date, section and vessel — and where jurisdiction changes under you."],
                ["05", "Field-check requirement", "The same-day work you must complete. Incomplete means not-go."],
              ].map(([n, title, body]) => (
                <li key={n} className="group flex gap-6 py-7">
                  <span className="data text-xs text-brass">{n}</span>
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                      {title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------- SPLIT: two ways in ---------- */}
      <section className="grid border-y border-hairline md:grid-cols-2">
        <Link
          to="/plan"
          className="group relative isolate flex min-h-[26rem] flex-col justify-end overflow-hidden p-8 sm:p-12"
        >
          <img
            src={riverImg}
            alt="A cold braided river corridor cutting past a gravel bar in morning mist"
            width={1280}
            height={960}
            loading="lazy"
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45 transition-transform duration-[1200ms] group-hover:scale-105"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-abyss via-abyss/70 to-transparent" />
          <p className="tick text-brass">Guided</p>
          <h3 className="mt-4 font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold leading-[0.98] tracking-[-0.035em] text-foreground">
            Declare the job.
            <br />
            Take the water that fits.
          </h3>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-foreground/75">
            Bank, kayak, small boat, scouting, tournament-adjacent or a family
            day — with your time window, gear and wind tolerance applied before
            anything is ranked.
          </p>
          <span className="tick mt-6 text-primary">Start the plan →</span>
        </Link>

        <Link
          to="/explore"
          className="group relative isolate flex min-h-[26rem] flex-col justify-end overflow-hidden p-8 sm:p-12"
        >
          <img
            src={flatsImg}
            alt="Tidal flats at low water with winding channels beneath a distant squall"
            width={1280}
            height={960}
            loading="lazy"
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40 transition-transform duration-[1200ms] group-hover:scale-105"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/75 to-transparent" />
          <p className="tick text-brass">Open</p>
          <h3 className="mt-4 font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold leading-[0.98] tracking-[-0.035em] text-foreground">
            Or walk the whole
            <br />
            catalog, slowly.
          </h3>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-foreground/75">
            {destinations.length} records across {states.length} states, filtered
            by state, water type and readiness band. Exploration without the
            spreadsheet.
          </p>
          <span className="tick mt-6 text-primary">Open the catalog →</span>
        </Link>
      </section>

      {/* ---------- BEST DOCUMENTED ---------- */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="tick text-brass">Best documented right now</p>
            <h2 className="mt-4 font-display text-[clamp(1.7rem,3.2vw,2.6rem)] font-bold tracking-[-0.035em] text-foreground">
              Highest field readiness
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            Readiness measures how completely the record supports a decision —
            not how well the fishing will go. It never claims to know the water
            today.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {featured.map(({ d }) => (
            <WaterCard key={d.id} destination={d} />
          ))}
        </div>
      </section>

      {/* ---------- REFUSALS ---------- */}
      <section className="border-y border-hairline bg-abyss">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 md:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="tick text-alert">What this instrument will not tell you</p>
            <h2 className="mt-5 font-display text-[clamp(1.8rem,3.6vw,3rem)] font-bold leading-[0.96] tracking-[-0.04em] text-foreground">
              The gaps are
              <br />
              printed on the dial.
            </h2>
            <Link
              to="/boundary"
              className="tick mt-8 inline-block text-primary hover:text-brass"
            >
              Read the boundary →
            </Link>
          </div>
          <ul className="grid gap-px self-start bg-hairline sm:grid-cols-2">
            {REFUSALS.map((r) => (
              <li key={r} className="bg-abyss px-5 py-6 text-sm text-muted-foreground">
                <span className="mb-3 block h-px w-6 bg-alert" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- CONSTRAINED EXAMPLE ---------- */}
      {constrained && (
        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:items-center">
            <div>
              <p className="tick text-watch">Worked example</p>
              <h2 className="mt-4 font-display text-[clamp(1.7rem,3.2vw,2.6rem)] font-bold leading-[1] tracking-[-0.035em] text-foreground">
                A constrained record
                <br />
                still gets an honest read.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
                Low readiness does not mean stay home. It means the record cannot
                carry the decision on its own, and the same-day checks are doing
                most of the work.
              </p>
            </div>
            <WaterCard destination={constrained.d} />
          </div>
        </section>
      )}

      </main>
      <SiteFooter />
    </div>
  );
}