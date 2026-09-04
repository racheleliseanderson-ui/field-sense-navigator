/**
 * Hook the Horizon — take the drawing with you.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk at
 * src/lib/field-plates/. Edit it there and run `node scripts/sync-fleet-shared.mjs`.
 *
 * Every instrument in this fleet ends up drawing the answer, and until now the
 * answer only existed inside a browser tab. The rig you worked out at the
 * kitchen table, the finished check for the joint you are about to tie, the
 * path the presentation has to travel — all of it needed the app open, a
 * charged phone and, for a first visit to that page, a signal. That is the
 * wrong dependency for the one hour it matters. A picture in the camera roll
 * has none of it, and it can be sent to somebody who does not use any of this.
 *
 * So a plate can be saved as a card: the drawing, its title, and a date, on
 * the app's own ground. PNG because that is what a phone photo library and a
 * message thread both accept, SVG because that is what prints and survives
 * being scaled up on a laptop later.
 *
 * The whole thing happens on the device. Nothing is uploaded, no canvas is
 * sent anywhere, and it works with no signal — which is the entire point.
 *
 * Two things make it harder than it sounds, and both are handled here:
 *
 *  1. The plates draw in CSS custom properties, so a serialized SVG lifted out
 *     of the page has `var(--hthp-ink, ...)` where a colour should be and
 *     rasterizes to black or nothing at all. Every var() is resolved against
 *     the live plate's own cascade first, fallbacks and nesting included, so
 *     the saved card carries the theme the reader was actually looking at.
 *  2. An SVG rasterized through an <img> cannot reach a webfont. The token
 *     stacks all end in a system family, which is what the card renders in —
 *     close enough that it still looks like the app, and legible everywhere.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/* ------------------------------------------------------------------ */
/* Resolving var() against a live element                              */
/* ------------------------------------------------------------------ */

/**
 * Replace every `var(--name, fallback)` in `markup` with what that property
 * actually resolves to on `host`, recursively — fallbacks are frequently
 * another var(), which is how the kit stays legible in an app that never
 * defined a single token.
 */
export function resolveCssVars(markup: string, host: Element): string {
  const style = getComputedStyle(host);
  const seen = new Map<string, string>();
  return resolveVarsWith(markup, (name) => {
    const hit = seen.get(name);
    if (hit !== undefined) return hit;
    const value = style.getPropertyValue(name).trim();
    seen.set(name, value);
    return value;
  });
}

/**
 * The same substitution against any lookup, which is what makes it testable
 * without a browser — and the parser is the part that can actually be wrong.
 */
export function resolveVarsWith(markup: string, lookup: (name: string) => string): string {
  let text = markup;
  let from = 0;
  /*
   * A whole plate can carry hundreds of tokens, so this counts substitutions
   * rather than nesting depth — an earlier version capped at a depth of eight
   * and would have left every colour past the eighth unresolved. The cap that
   * remains is only there so a token defined in terms of itself stops.
   */
  for (let guard = 0; guard < 50_000; guard += 1) {
    const at = text.indexOf("var(", from);
    if (at === -1) break;

    /* Find the parenthesis this var() closes with, counting nesting. */
    let level = 0;
    let end = -1;
    for (let i = at + 3; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === "(") level += 1;
      else if (ch === ")") {
        level -= 1;
        if (level === 0) {
          end = i;
          break;
        }
      }
    }
    /* Unbalanced: not something we can reason about, so leave it alone and
       carry on past it rather than stopping the whole document here. */
    if (end === -1) {
      from = at + 4;
      continue;
    }

    const { head, tail } = splitOnce(text.slice(at + 4, end));
    const name = head.trim();
    const value = name.startsWith("--") ? lookup(name) : "";
    const raw = value !== "" ? value : tail !== null ? tail.trim() : "";
    /*
     * Substituted values land inside double-quoted XML attributes, and a font
     * stack resolves to `"JetBrains Mono", ui-monospace, monospace` — quotes
     * and all. Left alone those close the attribute early, the serialized SVG
     * stops being well-formed, and the rasterizer refuses the whole document
     * with no error worth reading. Single quotes mean the same thing to CSS.
     */
    const chosen = raw.replace(/"/g, "'");

    text = text.slice(0, at) + chosen + text.slice(end + 1);
    /* Resume at the same spot: the fallback we just substituted is very often
       another var(), which is how the kit stays legible in an app that never
       defined a single token. */
    from = at;
  }
  return text;
}

/** Split at the first top-level comma, so a nested var()'s comma is left alone. */
function splitOnce(text: string): { head: string; tail: string | null } {
  let level = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(") level += 1;
    else if (ch === ")") level -= 1;
    else if (ch === "," && level === 0) {
      return { head: text.slice(0, i), tail: text.slice(i + 1) };
    }
  }
  return { head: text, tail: null };
}

/* ------------------------------------------------------------------ */
/* Building the card                                                   */
/* ------------------------------------------------------------------ */

const PAD = 26;
const HEAD = 74;
const FOOT = 38;

export interface CardText {
  eyebrow: string;
  title: string;
  /**
   * The line under the title.
   *
   * On several plates this is where the card's identity lives — the species
   * and the conditions a presentation brief was worked out for, the job a rig
   * was drawn against. Dropping it produced the kind of note you find in a
   * camera roll a month later and delete because you cannot tell what it was
   * for.
   */
  caption?: string | undefined;
  /** Rendered under the drawing. The app, and the date it was saved. */
  credit: string;
}

/**
 * The app's own name, taken from the head rather than passed in, so the kit
 * stays app-agnostic and no instrument has to remember to configure this.
 */
export function siteName(): string {
  if (typeof document === "undefined") return "Hook the Horizon";
  const named = document.querySelector<HTMLMetaElement>('meta[name="application-name"]');
  const og = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]');
  return named?.content?.trim() || og?.content?.trim() || "Hook the Horizon";
}

/** One line, cut where it would otherwise run off the card. */
function fit(text: string, width: number, size: number): string {
  const max = Math.max(8, Math.floor(width / (size * 0.52)));
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Wrap a plate's drawing in a titled card, with every token resolved.
 *
 * Returns null when the plate holds no drawing — some plates are legend and
 * prose, and offering to save a picture of nothing is worse than not offering.
 */
/* ------------------------------------------------------------------ */
/* The words under the drawing                                         */
/* ------------------------------------------------------------------ */

/**
 * A saved card used to be the drawing and nothing else, which is fine for a
 * schematic whose labels are inside it and useless for every plate whose
 * meaning lives in the legend — the numbered rows, and the line saying what
 * the drawing could not show. Somebody saved a card, opened it on the water,
 * and had a picture with the reasoning left behind in a browser tab.
 *
 * So the card carries them. Wrapped to the card's width with the browser's
 * own text measurement rather than a guess at average character width, which
 * is the difference between a tidy block and one that runs off the edge.
 */
export type CardLine = {
  /** Numbered rows keep their number. */
  badge?: string | undefined;
  /** The swatch or badge colour, already resolved. */
  tone?: string | undefined;
  label?: string | undefined;
  body?: string | undefined;
};

const LEGEND_SIZE = 12.5;
const LEGEND_LEAD = 17;
const LEGEND_INDENT = 24;
/* A card is a card. Past this it is a document, and a document is what the
   app already is. */
const MAX_LEGEND_ROWS = 14;

let ruler: CanvasRenderingContext2D | null = null;

function measure(text: string, font: string): number {
  if (!ruler) ruler = document.createElement("canvas").getContext("2d");
  if (!ruler) return text.length * LEGEND_SIZE * 0.52;
  ruler.font = font;
  return ruler.measureText(text).width;
}

/**
 * Greedy wrap against any measurer.
 *
 * Separated from the browser so it can be tested: a word wider than the line
 * takes the line on its own rather than looping forever, which is the bug
 * every hand-rolled wrapper has the first time.
 */
export function wrapWith(text: string, width: number, widthOf: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && widthOf(next) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The same wrap, measured by the browser in the font the card will use. */
export function wrapText(text: string, width: number, font: string): string[] {
  return wrapWith(text, width, (t) => measure(t, font));
}

/** The legend rows and the unknown line, read off the live plate. */
export function cardLines(plate: Element): CardLine[] {
  const out: CardLine[] = [];

  for (const row of plate.querySelectorAll(".hthp-legend__row")) {
    const badgeEl = row.querySelector(".hthp-legend__badge");
    const swatch = row.querySelector(".hthp-legend__swatch:not(.hthp-legend__swatch--none)");
    const source = badgeEl ?? swatch;
    out.push({
      badge: badgeEl?.textContent?.trim() || undefined,
      tone: source ? getComputedStyle(source).backgroundColor : undefined,
      label: row.querySelector(".hthp-legend__label")?.textContent?.trim() || undefined,
      body: row.querySelector(".hthp-legend__body")?.textContent?.trim() || undefined,
    });
  }

  /* Never dropped, whatever else is trimmed: what a drawing could not show is
     the thing a reader assumes in its absence. */
  const unknown = plate.querySelector('[data-testid="plate-unknown"]')?.textContent?.trim();

  const trimmed = out.slice(0, MAX_LEGEND_ROWS);
  if (out.length > trimmed.length) {
    trimmed.push({
      body: `${out.length - trimmed.length} more rows are in the app. This card holds the first ${trimmed.length}.`,
    });
  }
  if (unknown) trimmed.push({ label: "Not shown", body: unknown });
  return trimmed;
}

export function buildCard(
  frame: Element,
  text: CardText,
): { markup: string; w: number; h: number } | null {
  const svg = frame.querySelector("svg");
  if (!svg) return null;

  const box = svg.getAttribute("viewBox");
  const parts = box
    ? box
        .trim()
        .split(/[\s,]+/)
        .map(Number)
    : null;
  if (!parts || parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [, , vw, vh] = parts as [number, number, number, number];

  const clone = svg.cloneNode(true) as SVGSVGElement;
  /* The live plate sizes itself with inline width:100%; a card is a fixed
     drawing and that style would make it collapse. */
  clone.removeAttribute("style");
  /*
   * `currentColor` is the other way a drawing arrives in the page's colours,
   * and it is the one a var() sweep cannot see. Inside a rasterized SVG it
   * falls back to black, which on this fleet's dark grounds is a card with an
   * invisible diagram on it. Pinning the colour the drawing actually inherits
   * is the whole fix.
   */
  clone.setAttribute("style", `color:${getComputedStyle(svg).color}`);
  clone.setAttribute("x", String(PAD));
  /* y is set once the caption height is known, further down. */
  clone.setAttribute("width", String(vw));
  clone.setAttribute("height", String(vh));

  const w = vw + PAD * 2;

  const style = getComputedStyle(frame);
  const paper =
    style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)"
      ? style.backgroundColor
      : resolveCssVars("var(--hthp-paper, var(--background, #ffffff))", frame);
  const ink = resolveCssVars("var(--hthp-ink, var(--foreground, #16191c))", frame);
  const muted = resolveCssVars("var(--hthp-muted, var(--muted-foreground, #6b7280))", frame);
  const accent = resolveCssVars("var(--hthp-accent, var(--brass, #b08428))", frame);
  const line = resolveCssVars(
    "var(--hthp-line, var(--panel-border, rgba(128,128,128,0.32)))",
    frame,
  );
  const mono = resolveCssVars(
    "var(--hthp-mono, var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace))",
    frame,
  );
  const sans = resolveCssVars(
    "var(--hthp-sans, var(--font-sans, ui-sans-serif, system-ui, sans-serif))",
    frame,
  );

  const titleSize = 20;

  /* The caption, wrapped and capped: two lines of identity, not a paragraph. */
  const captionLines = text.caption ? wrapText(text.caption, vw, `13px ${sans}`).slice(0, 2) : [];
  const capHeight = captionLines.length * 18;
  clone.setAttribute("y", String(HEAD + capHeight));

  const inner = resolveCssVars(new XMLSerializer().serializeToString(clone), frame);

  /* The legend, wrapped to the card and laid out under the drawing. */
  const plate = frame.closest(".hthp-plate") ?? frame;
  const legendFont = `${LEGEND_SIZE}px ${sans}`;
  const boldFont = `700 ${LEGEND_SIZE}px ${sans}`;
  const textWidth = vw - LEGEND_INDENT;

  let cursor = HEAD + capHeight + vh + 22;
  const legendMarkup: string[] = [];

  for (const row of cardLines(plate)) {
    const head = row.label ? `${row.label}${row.body ? " — " : ""}` : "";
    /* The label is bold and the body follows it on the same line, so the two
       are wrapped together against a font that is a compromise between them.
       Getting this exactly right would need per-run measurement; being a few
       characters conservative is invisible and never overflows. */
    const lines = wrapText(`${head}${row.body ?? ""}`, textWidth, boldFont);
    if (row.badge) {
      legendMarkup.push(
        `<circle cx="${PAD + 8}" cy="${cursor - 4}" r="8" fill="${row.tone ?? accent}"/>` +
          `<text x="${PAD + 8}" y="${cursor - 0.5}" text-anchor="middle" font-family="${mono}" ` +
          `font-size="9" font-weight="700" fill="${paper}">${escapeText(row.badge)}</text>`,
      );
    } else if (row.tone) {
      legendMarkup.push(
        `<rect x="${PAD + 2}" y="${cursor - 11}" width="11" height="11" fill="${row.tone}"/>`,
      );
    }
    for (const [i, text] of lines.entries()) {
      legendMarkup.push(
        `<text x="${PAD + LEGEND_INDENT}" y="${cursor + i * LEGEND_LEAD}" ` +
          `font-family="${sans}" font-size="${LEGEND_SIZE}" fill="${i === 0 ? ink : muted}">` +
          `${escapeText(text)}</text>`,
      );
    }
    cursor += lines.length * LEGEND_LEAD + 9;
  }

  const legendHeight = legendMarkup.length ? cursor - (HEAD + capHeight + vh) - 9 : 0;
  const h = vh + HEAD + capHeight + FOOT + legendHeight;

  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${paper}"/>` +
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" stroke="${line}"/>` +
    `<text x="${PAD}" y="30" font-family="${mono}" font-size="10.5" letter-spacing="1.7" ` +
    `fill="${accent}">${escapeText(fit(text.eyebrow.toUpperCase(), vw, 11))}</text>` +
    `<text x="${PAD}" y="56" font-family="${sans}" font-size="${titleSize}" font-weight="700" ` +
    `fill="${ink}">${escapeText(fit(text.title, vw, titleSize))}</text>` +
    captionLines
      .map(
        (l, i) =>
          `<text x="${PAD}" y="${78 + i * 18}" font-family="${sans}" font-size="13" ` +
          `fill="${muted}">${escapeText(l)}</text>`,
      )
      .join("") +
    inner +
    legendMarkup.join("") +
    `<text x="${PAD}" y="${h - 14}" font-family="${mono}" font-size="10" letter-spacing="1.2" ` +
    `fill="${muted}">${escapeText(fit(text.credit.toUpperCase(), vw, 10.5))}</text>` +
    `</svg>`;

  return { markup, w, h };
}

/** Rasterize the card. Two-times so it stays sharp on a phone screen. */
export async function cardToPng(markup: string, w: number, h: number, scale = 2): Promise<Blob> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = new Image();
  image.decoding = "sync";
  await new Promise<void>((done, fail) => {
    image.onload = () => done();
    image.onerror = () => fail(new Error("the drawing could not be rendered"));
    image.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("this browser gave us no canvas to draw on");
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0, w, h);
  return await new Promise<Blob>((done, fail) => {
    canvas.toBlob(
      (blob) => (blob ? done(blob) : fail(new Error("the image came back empty"))),
      "image/png",
    );
  });
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "plate"
  );
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  /* Revoked on the next frame: some browsers have not started the download
     by the time the click handler returns. */
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ------------------------------------------------------------------ */
/* The control                                                         */
/* ------------------------------------------------------------------ */

type SaveState = "idle" | "working" | "done" | "failed";

/**
 * Two small buttons in the plate head. Deliberately quiet: this is a thing
 * somebody looks for once they already want it, not a call to action on top
 * of a diagram they are still reading.
 */
export function PlateSave({
  frameRef,
  eyebrow,
  title,
  caption,
}: {
  frameRef: RefObject<HTMLDivElement | null>;
  eyebrow: string;
  title: string;
  caption?: string | undefined;
}) {
  const [state, setState] = useState<SaveState>("idle");
  /* Some plates are legend and prose with no drawing in them at all, and
     offering to save a picture of nothing is worse than not offering. This
     also keeps the control off the server-rendered pass, where there is no
     DOM to ask. */
  const [hasDrawing, setHasDrawing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHasDrawing(Boolean(frameRef.current?.querySelector("svg")));
  }, [frameRef]);

  const flash = useCallback((next: SaveState) => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2600);
  }, []);

  const build = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return null;
    const when = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return buildCard(frame, {
      eyebrow,
      title,
      ...(caption ? { caption } : {}),
      credit: `${siteName()} · saved ${when}`,
    });
  }, [frameRef, eyebrow, title, caption]);

  const save = useCallback(
    async (kind: "png" | "svg") => {
      setState("working");
      try {
        const card = build();
        if (!card) {
          flash("failed");
          return;
        }
        const name = `${slugify(title)}.${kind}`;
        if (kind === "svg") {
          saveBlob(new Blob([card.markup], { type: "image/svg+xml;charset=utf-8" }), name);
        } else {
          saveBlob(await cardToPng(card.markup, card.w, card.h), name);
        }
        flash("done");
      } catch {
        /* Nothing here is worth an error dialog. The plate is still on screen
           and a screenshot has always been the fallback. */
        flash("failed");
      }
    },
    [build, flash, title],
  );

  if (!hasDrawing) return null;

  return (
    <div className="hthp-save no-print" data-testid="plate-save">
      <span className="hthp-save__label" aria-hidden="true">
        {state === "done" ? "Saved" : state === "failed" ? "Could not save" : "Save"}
      </span>
      <button
        type="button"
        className="hthp-save__btn"
        disabled={state === "working"}
        onClick={() => void save("png")}
      >
        PNG
        <span className="hthp-save__sr"> — save “{title}” as a picture</span>
      </button>
      <button
        type="button"
        className="hthp-save__btn"
        disabled={state === "working"}
        onClick={() => void save("svg")}
      >
        SVG
        <span className="hthp-save__sr"> — save “{title}” as a drawing that prints</span>
      </button>
    </div>
  );
}
