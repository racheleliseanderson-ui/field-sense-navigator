import type { CSSProperties, Ref } from "react";
import { FULL_BLEED, type Plate } from "@/lib/imagery";

type Scrim = "hero" | "band" | "side" | "soft" | "none";

const SCRIM: Record<Scrim, string> = {
  // full masthead: open at the top, settles into the page ground
  hero: "bg-linear-to-b from-abyss/60 via-abyss/45 to-background",
  // editorial band: ground both ends, image breathes in the middle
  band: "bg-linear-to-b from-abyss via-abyss/55 to-abyss",
  // copy on the left, image on the right
  side: "bg-linear-to-r from-abyss via-abyss/80 to-abyss/25",
  // light touch for split panels
  soft: "bg-linear-to-t from-abyss via-abyss/65 to-transparent",
  none: "",
};

/**
 * A photographic ground for a section. Always `absolute inset-0 -z-10`,
 * so wrap it in `relative isolate overflow-hidden`.
 *
 * Layers, back to front: image (treated, optionally parallaxed) → scrim →
 * brass sheen → grain. The section's own content sits above all of it.
 */
export function Art({
  plate,
  sizes = FULL_BLEED,
  scrim = "hero",
  opacity = 1,
  priority = false,
  parallax,
  sheen = true,
  grain = true,
  className = "",
  imgRef,
}: {
  plate: Plate;
  sizes?: string;
  scrim?: Scrim;
  /** 0–1; lower when copy must win over the image */
  opacity?: number;
  /** true for the first hero on a page — eager + high fetch priority */
  priority?: boolean;
  /** pass a useParallax ref to drift on scroll */
  parallax?: boolean;
  sheen?: boolean;
  grain?: boolean;
  className?: string;
  imgRef?: Ref<HTMLImageElement>;
}) {
  return (
    <div aria-hidden="true" className={`absolute inset-0 -z-10 ${className}`}>
      <img
        ref={imgRef}
        src={plate.src}
        srcSet={plate.srcSet}
        sizes={sizes}
        alt=""
        width={2400}
        height={1355}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
        className={`image-treated h-full w-full object-cover ${parallax ? "parallax" : ""}`}
        style={{ objectPosition: plate.position, opacity } as CSSProperties}
      />
      {scrim !== "none" && <div className={`absolute inset-0 ${SCRIM[scrim]}`} />}
      {sheen && <div className="sheen absolute inset-0 mix-blend-soft-light" />}
      {grain && <div className="grain absolute inset-0" />}
    </div>
  );
}

/** A framed photograph inside the flow — cards, split panels, asides. */
export function Plate({
  plate,
  sizes,
  className = "",
  ratio = "aspect-[16/10]",
  caption,
}: {
  plate: Plate;
  sizes: string;
  className?: string;
  ratio?: string;
  caption?: string;
}) {
  return (
    <figure className={`relative isolate overflow-hidden ${ratio} ${className}`}>
      <img
        src={plate.src}
        srcSet={plate.srcSet}
        sizes={sizes}
        alt={plate.alt}
        width={2400}
        height={1355}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="image-treated h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
        style={{ objectPosition: plate.position }}
      />
      <div className="grain absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
      {caption && (
        <figcaption className="tick absolute bottom-3 left-4 text-[0.55rem] text-foreground/70">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
