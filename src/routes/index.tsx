import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { WaterCard } from "@/components/water-card";
import { Art, Plate } from "@/components/art";
import { destinations, NAMED_WATER_COUNT, states } from "@/lib/catalog";
import { readiness } from "@/lib/intelligence";
import { PLATES, HALF_BLEED, CARD } from "@/lib/imagery";
import { useReveal, useParallax, useCountUp } from "@/lib/motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Field Sense Navigator · Public-Waters Field Instrument" },
      {
        name: "description",
        content:
          `A field guide for ${NAMED_WATER_COUNT} named public waters: readiness, ranking, and a printable brief.`,
      },
      { property: "og:title", content: "Field Sense Navigator · Public-Waters Field Instrument" },
      {
        property: "og:description",
        content:
          "Declare the job, rank the waters that actually fit, print a same-day brief. Public waters only — we will not guess when a check cannot be confirmed.",
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

const LAYERS = [
  ["Access & legality", "Published facilities, closures, directory-level networks, and the line where public corridor ends."],
  ["Conditions & hazards", "Standing hazard families the water is known for — wind fetch, tide, level swing, traffic. Never a forecast."],
  ["Capacity & crowding", "Documented pressure on parking, ramps and hours. Patterns, never live occupancy."],
  ["Seasonal & regulatory pressure", "Where rules move with date, section and vessel — and where jurisdiction changes under you."],
  ["Field-check requirement", "The same-day work you must complete. Incomplete means not-go."],
] as const;

function Readout({ k, v, delay }: { k: string; v: number; delay: number }) {
  const [n, ref] = useCountUp(v);
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className="px-5 py-6 sm:px-8 sm:py-7"
      data-reveal
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      <dt className="tick text-[0.55rem]">{k}</dt>
      <dd className="data mt-2 text-3xl font-semibold text-foreground sm:text-4xl">{n}</dd>
    </div>
  );
}

function Home() {
  const featured = [...destinations]
    .map((d) => ({ d, r: readiness(d) }))
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 3);

  const constrained = [...destinations]
    .map((d) => ({ d, r: readiness(d) }))
    .sort((a, b) => a.r.score - b.r.score)[0];

  const reveal = useReveal();
  const heroRef = useParallax(0.18);

  return (
    <div ref={reveal as React.Ref<HTMLDivElement>} className="page-in min-h-dvh bg-background">
      <SiteHeader />
      <main id="content">

      {/* ---------- HERO: the instrument face ---------- */}
      <section className="relative isolate overflow-hidden">
        <Art
          plate={PLATES.hero}
          scrim="hero"
          priority
          parallax
          imgRef={heroRef as React.Ref<HTMLImageElement>}
        />
        <div className="hairline-grid absolute inset-0 -z-10 opacity-20" aria-hidden="true" />

        <div className="mx-auto max-w-7xl px-safe pb-20 pt-28 sm:px-8 md:pb-28 md:pt-40 lg:pt-48">
          <div className="flex items-center gap-4" data-reveal>
            <span className="h-px w-12 bg-brass" data-reveal-rule />
            <p className="tick text-brass">Hook the Horizon</p>
          </div>

          <h1
            className="mt-8 max-w-5xl font-display text-[clamp(2.9rem,9vw,8rem)] font-bold uppercase leading-[0.86] tracking-[-0.045em] text-foreground"
            data-reveal
            style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
          >
            Read the water
            <br />
            <span className="text-brass">before</span> you drive to it.
          </h1>

          <p
            className="mt-8 max-w-xl text-base leading-relaxed text-foreground/85 sm:text-lg"
            data-reveal
            style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
          >
            Five intelligence layers over {NAMED_WATER_COUNT} named public
            waters. Declare the job you are actually doing, and the instrument
            ranks the water that fits it — then prints the same-day checks you
            have to clear before you go.
          </p>

          <div
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
            data-reveal
            style={{ "--reveal-delay": "240ms" } as React.CSSProperties}
          >
            <Link
              to="/plan"
              className="tap group inline-flex min-h-12 items-center justify-center gap-4 bg-brass px-7 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-accent-foreground transition-transform hover:-translate-y-0.5"
            >
              Plan a day
              <span className="h-px w-8 bg-accent-foreground/60 transition-all group-hover:w-12" />
            </Link>
            <Link
              to="/explore"
              className="tap inline-flex min-h-12 items-center justify-center gap-3 border border-hairline bg-abyss/50 px-7 py-4 text-sm font-medium uppercase tracking-[0.14em] text-foreground backdrop-blur transition-colors hover:border-brass/50"
            >
              Browse the catalog
            </Link>
          </div>

          <p className="tick mt-14 hidden text-[0.55rem] text-foreground/50 md:block" data-reveal>
            Plate 01 · Open water · First light under a storm shelf
          </p>
        </div>

        {/* readout strip */}
        <div className="relative border-y border-hairline bg-abyss/70 backdrop-blur">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-hairline sm:px-0 md:grid-cols-4 md:divide-y-0">
            <Readout k="Named waters" v={NAMED_WATER_COUNT} delay={0} />
            <Readout k="States & provinces" v={states.length} delay={60} />
            <Readout k="Intelligence layers" v={5} delay={120} />
            <Readout k="Private spots" v={0} delay={180} />
          </dl>
        </div>
      </section>

      {/* ---------- THE LAYERS: dark editorial band ---------- */}
      <section className="relative isolate overflow-hidden bg-abyss">
        <div className="halo absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-safe py-24 sm:px-8 md:py-32">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="tick text-brass" data-reveal>The stack</p>
              <h2
                className="mt-5 font-display text-[clamp(2rem,4.6vw,3.8rem)] font-bold leading-[0.95] tracking-[-0.04em] text-foreground"
                data-reveal
                style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
              >
                Five layers,
                <br />
                each one honest
                <br />
                about its edge.
              </h2>
              <p
                className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground"
                data-reveal
                style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
              >
                Every layer carries a confidence figure and a list of what it
                still cannot see. Nothing is inferred to fill a gap.
              </p>

              <div
                className="bezel mt-10 hidden max-w-md lg:block"
                data-reveal-crop
                style={{ "--reveal-delay": "240ms" } as React.CSSProperties}
              >
                <Plate plate={PLATES.still} sizes={HALF_BLEED} ratio="aspect-[16/10]" caption="Plate 06 · The brief" />
              </div>
            </div>

            <ol className="divide-y divide-hairline border-y border-hairline">
              {LAYERS.map(([title, body], i) => (
                <li
                  key={title}
                  className="group grid grid-cols-[3.2rem_1fr] gap-4 py-7 sm:grid-cols-[4.5rem_1fr] sm:gap-6"
                  data-reveal
                  style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}
                >
                  <span className="numeral text-3xl sm:text-4xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
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
          className="group relative isolate flex min-h-[24rem] flex-col justify-end overflow-hidden p-7 sm:min-h-[28rem] sm:p-12"
        >
          <Art plate={PLATES.river} sizes={HALF_BLEED} scrim="soft" className="transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]" />
          <p className="tick text-brass" data-reveal>Guided</p>
          <h3
            className="mt-4 font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold leading-[0.98] tracking-[-0.035em] text-foreground"
            data-reveal
            style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
          >
            Declare the job.
            <br />
            Take the water that fits.
          </h3>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-foreground/80" data-reveal style={{ "--reveal-delay": "140ms" } as React.CSSProperties}>
            Bank, kayak, small boat, scouting, tournament-adjacent or a family
            day — with your time window, gear and wind tolerance applied before
            anything is ranked.
          </p>
          <span className="tick mt-6 inline-flex min-h-11 items-center text-primary group-hover:text-brass">Start the plan →</span>
        </Link>

        <Link
          to="/explore"
          className="group relative isolate flex min-h-[24rem] flex-col justify-end overflow-hidden border-t border-hairline p-7 sm:min-h-[28rem] sm:p-12 md:border-l md:border-t-0"
        >
          <Art plate={PLATES.lake} sizes={HALF_BLEED} scrim="soft" className="transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]" />
          <p className="tick text-brass" data-reveal>Open</p>
          <h3
            className="mt-4 font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold leading-[0.98] tracking-[-0.035em] text-foreground"
            data-reveal
            style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
          >
            Or walk the whole
            <br />
            catalog, slowly.
          </h3>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-foreground/80" data-reveal style={{ "--reveal-delay": "140ms" } as React.CSSProperties}>
            {NAMED_WATER_COUNT} records across {states.length} states,
            provinces and territories, filtered by jurisdiction, water type and
            readiness band. Exploration without the spreadsheet.
          </p>
          <span className="tick mt-6 inline-flex min-h-11 items-center text-primary group-hover:text-brass">Open the catalog →</span>
        </Link>
      </section>

      {/* ---------- BEST DOCUMENTED ---------- */}
      <section className="mx-auto max-w-7xl px-safe py-24 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="tick text-brass" data-reveal>Best documented</p>
            <h2
              className="mt-4 font-display text-[clamp(1.7rem,3.2vw,2.6rem)] font-bold tracking-[-0.035em] text-foreground"
              data-reveal
              style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
            >
              Highest field readiness
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground" data-reveal>
            Readiness measures how completely the record supports a decision —
            not how well the fishing will go. It never claims to know the water
            today.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {featured.map(({ d }, i) => (
            <div key={d.id} data-reveal style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}>
              <WaterCard destination={d} art />
            </div>
          ))}
        </div>
      </section>

      {/* ---------- REFUSALS ---------- */}
      <section className="relative isolate overflow-hidden border-y border-hairline bg-abyss">
        <Art plate={PLATES.ramp} scrim="band" opacity={0.75} />
        <div className="mx-auto grid max-w-7xl gap-12 px-safe py-24 sm:px-8 md:grid-cols-[1fr_1.1fr] md:py-32">
          <div>
            <p className="tick text-alert" data-reveal>What this instrument will not tell you</p>
            <h2
              className="mt-5 font-display text-[clamp(1.8rem,3.6vw,3rem)] font-bold leading-[0.96] tracking-[-0.04em] text-foreground"
              data-reveal
              style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
            >
              The gaps are
              <br />
              printed on the dial.
            </h2>
            <Link
              to="/boundary"
              className="tick mt-8 inline-flex min-h-11 items-center text-primary hover:text-brass"
              data-reveal
              style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
            >
              Read the boundary →
            </Link>
          </div>
          <ul className="surface grid gap-px self-start bg-hairline sm:grid-cols-2" data-reveal style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
            {REFUSALS.map((r) => (
              <li key={r} className="bg-abyss/90 px-5 py-6 text-sm text-muted-foreground">
                <span className="mb-3 block h-px w-6 bg-alert" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- CONSTRAINED EXAMPLE ---------- */}
      {constrained && (
        <section className="mx-auto max-w-7xl px-safe py-24 sm:px-8">
          <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:items-center">
            <div>
              <p className="tick text-watch" data-reveal>Worked example</p>
              <h2
                className="mt-4 font-display text-[clamp(1.7rem,3.2vw,2.6rem)] font-bold leading-[1] tracking-[-0.035em] text-foreground"
                data-reveal
                style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
              >
                A constrained record
                <br />
                still gets an honest read.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground" data-reveal style={{ "--reveal-delay": "160ms" } as React.CSSProperties}>
                Low readiness does not mean stay home. It means the record cannot
                carry the decision on its own, and the same-day checks are doing
                most of the work.
              </p>
            </div>
            <div data-reveal style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
              <WaterCard destination={constrained.d} art />
            </div>
          </div>
        </section>
      )}

      {/* ---------- FLEET ---------- */}
      <section className="relative isolate overflow-hidden border-t border-hairline">
        <Art plate={PLATES.flats} scrim="band" opacity={0.7} />
        <div className="mx-auto max-w-7xl px-safe py-20 sm:px-8 md:py-28">
          <p className="tick text-brass" data-reveal>Hook the Horizon · The fleet</p>
          <h2
            className="mt-4 max-w-3xl font-display text-[clamp(1.8rem,3.8vw,3.2rem)] font-bold leading-[0.96] tracking-[-0.04em] text-foreground"
            data-reveal
            style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
          >
            One field. Several instruments.
          </h2>
          <div className="mt-10 grid gap-px bg-hairline sm:grid-cols-2 lg:grid-cols-4" data-reveal style={{ "--reveal-delay": "160ms" } as React.CSSProperties}>
            {[
              ["Waterways", "This instrument. Public waters, read before you drive.", "https://waterways.hookthehorizon.blog/", true],
              ["Species", "Behavior hypotheses and presentation families — not bite scores.", "https://species.hookthehorizon.blog/", false],
              ["Knot", "Decide, diagnose and compare the knot for the job.", "https://knot.hookthehorizon.blog/", false],
              ["The blog", "Long-form field notes from Hook the Horizon.", "https://hookthehorizon.blog/", false],
            ].map(([name, body, href, current]) => (
              <a
                key={name as string}
                href={href as string}
                aria-current={current ? "page" : undefined}
                className="tap group flex min-h-36 flex-col justify-between bg-abyss/85 p-6 backdrop-blur transition-colors hover:bg-abyss/70"
              >
                <span className="tick text-[0.55rem] text-brass">{current ? "You are here" : "Open"}</span>
                <span>
                  <span className="block font-display text-xl font-bold tracking-tight text-foreground">{name}</span>
                  <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{body}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      </main>
      <SiteFooter />
    </div>
  );
}
