import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import rampImg from "@/assets/ramp.jpg";

export const Route = createFileRoute("/boundary")({
  head: () => ({
    meta: [
      { title: "Boundary & Method · Field Sense Navigator" },
      {
        name: "description",
        content:
          "What Field Sense Navigator includes, what it refuses to hold, and how the fail-closed field-check doctrine works for named public waters.",
      },
      { property: "og:title", content: "Boundary & Method · Field Sense Navigator" },
      {
        property: "og:description",
        content:
          "Public waters only. No private spots, no coordinates, no live-condition claims. The scope rules behind every record.",
      },
    ],
  }),
  component: BoundaryPage,
});

const IN_SCOPE = [
  "Named public waterbodies and officially published public access facilities.",
  "Notices and advisories that the managing agency has published.",
  "Verification steps the operator must complete on the day of travel.",
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

function BoundaryPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="content">

      <section className="relative overflow-hidden border-b border-hairline">
        <img
          src={rampImg}
          alt="A wet public boat ramp descending into cold water before dawn"
          width={1280}
          height={960}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-abyss/70" />
        <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 md:py-32">
          <p className="tick text-brass">Doctrine</p>
          <h1 className="mt-5 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.6rem)] font-bold leading-[0.94] tracking-[-0.04em] text-foreground">
            The boundary is the product.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Everything this instrument is willing to say is bounded by what a
            public agency has already published. Where the record runs out, we
            say so and stop. That refusal is not a limitation of the tool — it is
            the tool.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-px bg-hairline px-0 sm:mx-auto md:grid-cols-2">
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
          <p className="tick text-alert">Refused, permanently</p>
          <ul className="mt-6 space-y-5">
            {OUT_OF_SCOPE.map((x) => (
              <li key={x} className="flex gap-4">
                <span className="mt-2.5 h-px w-6 shrink-0 bg-alert" />
                <span className="text-base leading-relaxed text-muted-foreground">
                  {x}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="font-display text-[clamp(1.8rem,3.6vw,3rem)] font-bold leading-[1] tracking-[-0.035em] text-foreground">
              Fail closed,
              <br />
              every time.
            </h2>
          </div>
          <div className="space-y-6 text-base leading-relaxed text-muted-foreground">
            <p>
              A water is only <span className="text-foreground">go</span> when
              every same-day check has been completed by the person travelling.
              If a check cannot be completed — the phone rings out, the page is
              down, the sign is missing — the default answer is not-go. The
              instrument never fills that gap with an inference.
            </p>
            <p>
              Confidence figures describe how well documented a layer is, not how
              likely a day is to go well. They never reach 100, because the
              record is always older than the water.
            </p>
            <p>
              Posted signage and the managing authority outrank anything printed
              from this system, including a field packet you carried in your
              pocket.
            </p>
            <Link
              to="/plan"
              className="inline-flex items-center gap-3 border border-brass/50 bg-brass/10 px-6 py-3 text-sm font-medium text-brass transition-colors hover:bg-brass/20"
            >
              Plan a day within the boundary
            </Link>
          </div>
        </div>
      </section>

      </main>
      <SiteFooter />
    </div>
  );
}