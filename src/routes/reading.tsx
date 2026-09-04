import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { SiteHeader, SiteFooter } from "@/components/chrome";
import { PlanViewBoard } from "@/components/plan-view";
import { ReadLevelControl } from "@/components/water-reading";
import { useReadLevel } from "@/lib/read-level";
import { waterTypes, type WaterType } from "@/lib/catalog";
import { withIdentity } from "@/lib/seo";

/**
 * Reading water — the school.
 *
 * Every other page in this instrument starts from a named water and answers
 * questions about it. This one starts from nothing and teaches the craft
 * underneath all of them, because the catalogue is finite and the number of
 * rivers a person will stand beside is not.
 *
 * It is deliberately the one page with no records in it. No readiness band,
 * no source date, no access status. Just the shape of four kinds of water and
 * a set of controls that move them.
 */

export const Route = createFileRoute("/reading")({
  head: () =>
    withIdentity(
      { path: "/reading" },
      {
        meta: [
          { title: "Reading water · Field Sense Navigator" },
          {
            name: "description",
            content:
              "Learn to read a river, a lake, a reservoir arm and a stretch of coast from above — with the wind, the water level and the tide as controls that visibly move which water is worth walking to.",
          },
          { property: "og:title", content: "Reading water · Field Sense Navigator" },
          {
            property: "og:description",
            content:
              "Four water-reading schematics with the conditions as a control. Not a hotspot map — the craft underneath one.",
          },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary_large_image" },
        ],
      },
    ),
  component: ReadingPage,
});

const CLASS_LABEL: Record<WaterType, string> = {
  river: "River & stream",
  lake: "Natural lake",
  reservoir: "Reservoir",
  marine: "Coast & estuary",
};

const CLASS_HOOK: Record<WaterType, string> = {
  river:
    "Current does the arranging. Learn one bend properly and you have learned most of the moving water you will ever fish.",
  lake: "No current, so the wind is the current. The good bank is decided overnight.",
  reservoir: "A drowned valley with a river still running under it. The level moving is the event.",
  marine: "The tide is the current, and it rebuilds the whole picture twice a day.",
};

function ReadingPage() {
  const { level, setLevel } = useReadLevel();
  const [waterType, setWaterType] = useState<WaterType>("river");

  return (
    <div className="page-in min-h-dvh bg-background">
      <SiteHeader />
      <main id="content" className="mx-auto max-w-7xl px-5 pb-24 pt-10 sm:px-8">
        <div className="flex items-center gap-4">
          <span className="h-px w-10 bg-brass" />
          <p className="tick text-brass">Reading water</p>
        </div>
        <h1 className="mt-5 max-w-4xl font-display text-[clamp(2rem,5vw,3.4rem)] font-bold leading-[1.02] tracking-[-0.04em] text-foreground">
          Every water you have never seen is a version of one of these four
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
          The rest of this instrument answers questions about waters somebody has already written
          down. This page is the part that travels — the craft that lets you walk up to a river
          nobody has ever catalogued and know within five minutes where the interesting water is.
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          There are no real places in here. Nothing on these drawings claims to exist anywhere
          specific, nothing predicts a fish, and nothing on this page knows what the weather is
          doing. The conditions are a <em>control</em>: you set them, and the picture shows you what
          that state does to water of this kind — including which features stop mattering entirely.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {waterTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setWaterType(type)}
              aria-pressed={waterType === type}
              className={`tap min-h-11 border px-4 py-2 text-left transition ${
                waterType === type
                  ? "border-brass bg-brass/10 text-brass"
                  : "border-hairline text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="block font-display text-sm font-bold uppercase tracking-[0.1em]">
                {CLASS_LABEL[type]}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/80">
          {CLASS_HOOK[waterType]}
        </p>

        <div className="mt-8">
          <PlanViewBoard key={waterType} waterType={waterType} level={level} />
        </div>

        <ReadLevelControl level={level} setLevel={setLevel} className="mt-8 max-w-2xl" />

        <section className="panel mt-12 p-5 md:p-7">
          <p className="tick text-brass">Where this goes next</p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
            A read is not a plan until it meets a fish and a piece of tackle
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Knowing that the outside of the bend is deep does not tell you what is living in it or
            how to fish it. That is the next instrument along, and it wants to know what kind of
            water you decided you were looking at.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/"
              className="tap inline-flex min-h-11 items-center border border-brass/50 bg-brass/10 px-5 text-xs uppercase tracking-[0.18em] text-brass transition hover:bg-brass/20"
            >
              Check a named water
            </Link>
            <Link
              to="/plan"
              className="tap inline-flex min-h-11 items-center border border-hairline px-5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
            >
              Plan a day
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
