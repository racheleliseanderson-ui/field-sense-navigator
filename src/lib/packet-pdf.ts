import { jsPDF } from "jspdf";

import { catalogTags, datedWindows, displayName, humanize, reviewOverdue, tagLabel, windowSpan, type Destination } from "@/lib/catalog";
import {
  CHECK_GROUPS,
  DEFAULT_CONSTRAINTS,
  JOBS,
  buildChecklist,
  buildLayers,
  readTags,
  readiness,
  type JobId,
} from "@/lib/intelligence";
import { readAccess } from "@/lib/access";
import { cuesFor, readWater, type ReadLevel } from "@/lib/water-reading";

/* Letter, points. A paged briefing document rendered as vector text so it
 * stays selectable, searchable and small — not a screenshot of the page. */
const PAGE_W = 612;
const PAGE_H = 792;
const M = 54;
const CONTENT_W = PAGE_W - M * 2;
const FOOT = PAGE_H - 54;

const INK: [number, number, number] = [16, 20, 27];
const MUTED: [number, number, number] = [90, 99, 114];
const RULE: [number, number, number] = [200, 205, 214];

interface Ctx {
  doc: jsPDF;
  y: number;
  page: number;
  issued: string;
}

function newDoc(): jsPDF {
  return new jsPDF({ unit: "pt", format: "letter", compress: true });
}

function footer(ctx: Ctx) {
  const { doc } = ctx;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.line(M, FOOT, PAGE_W - M, FOOT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("FIELD SENSE NAVIGATOR — PUBLIC WATERS ONLY", M, FOOT + 14);
  doc.text(`Issued ${ctx.issued}  ·  Page ${ctx.page}`, PAGE_W - M, FOOT + 14, {
    align: "right",
  });
}

function breakPage(ctx: Ctx) {
  footer(ctx);
  ctx.doc.addPage();
  ctx.page += 1;
  ctx.y = M;
}

/** Reserve vertical space; start a new page rather than orphan a block. */
function need(ctx: Ctx, h: number) {
  if (ctx.y + h > FOOT - 18) breakPage(ctx);
}

function rule(ctx: Ctx, gap = 14) {
  ctx.y += gap;
  need(ctx, 2);
  ctx.doc.setDrawColor(...RULE);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(M, ctx.y, PAGE_W - M, ctx.y);
  ctx.y += gap;
}

function tick(ctx: Ctx, label: string) {
  need(ctx, 20);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(7.5);
  ctx.doc.setTextColor(...MUTED);
  ctx.doc.text(label.toUpperCase(), M, ctx.y, { charSpace: 1.2 });
  ctx.y += 14;
}

function paragraph(
  ctx: Ctx,
  text: string,
  opts: { size?: number; style?: "normal" | "bold"; color?: [number, number, number]; indent?: number; lead?: number } = {},
) {
  const size = opts.size ?? 9.5;
  const lead = opts.lead ?? size * 1.42;
  const indent = opts.indent ?? 0;
  ctx.doc.setFont("helvetica", opts.style ?? "normal");
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(...(opts.color ?? INK));
  const lines = ctx.doc.splitTextToSize(text, CONTENT_W - indent) as string[];
  for (const line of lines) {
    need(ctx, lead);
    ctx.doc.setFont("helvetica", opts.style ?? "normal");
    ctx.doc.setFontSize(size);
    ctx.doc.setTextColor(...(opts.color ?? INK));
    ctx.doc.text(line, M + indent, ctx.y);
    ctx.y += lead;
  }
}

function checkbox(ctx: Ctx, text: string, source: string) {
  const lines = ctx.doc.splitTextToSize(text, CONTENT_W - 22) as string[];
  const blockH = lines.length * 13 + 11;
  need(ctx, blockH);
  const top = ctx.y - 7.5;
  ctx.doc.setDrawColor(...INK);
  ctx.doc.setLineWidth(0.7);
  ctx.doc.rect(M, top, 9, 9);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(9.5);
  ctx.doc.setTextColor(...INK);
  for (const line of lines) {
    ctx.doc.text(line, M + 22, ctx.y);
    ctx.y += 13;
  }
  ctx.doc.setFont("helvetica", "italic");
  ctx.doc.setFontSize(7.5);
  ctx.doc.setTextColor(...MUTED);
  ctx.doc.text(source, M + 22, ctx.y);
  ctx.y += 13;
}

function record(
  ctx: Ctx,
  d: Destination,
  job: JobId | null,
  level: ReadLevel = "working",
) {
  const r = readiness(d);
  const layers = buildLayers(d);
  const t = readTags(d);
  const access = readAccess(d);
  const read = readWater(d);
  const items = buildChecklist(d, job, job ? DEFAULT_CONSTRAINTS : null);
  const jobLabel = JOBS.find((j) => j.id === job)?.label ?? "Not declared";
  const { doc } = ctx;

  /* masthead */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("FIELD SENSE NAVIGATOR", M, ctx.y, { charSpace: 1.4 });
  doc.text(`RECORD ${d.id}`, PAGE_W - M, ctx.y, { align: "right" });
  ctx.y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text("Field brief", M, ctx.y);
  ctx.y += 8;
  rule(ctx, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...INK);
  for (const line of doc.splitTextToSize(displayName(d), CONTENT_W) as string[]) {
    need(ctx, 21);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(line, M, ctx.y);
    ctx.y += 21;
  }
  paragraph(
    ctx,
    `${d.region}, ${d.state}${d.county ? ` · ${d.county} County` : ""} · ${d.waterType}`,
    { size: 9, color: MUTED },
  );

  const overdue = reviewOverdue(d);
  if (overdue) {
    ctx.y += 8;
    paragraph(
      ctx,
      `Review overdue since ${d.nextReviewAt}. Re-read the official source before you treat this brief as current.`,
      { style: "bold", size: 9.5 },
    );
  }

  ctx.y += 8;
  const cols: Array<[string, string]> = [
    ["Declared job", jobLabel],
    ["Field readiness", `${r.score}/100`],
    ["Band", r.band],
    overdue
      ? ["Review overdue", `Due ${d.nextReviewAt}`]
      : ["Last source check", d.checkedAt.slice(0, 10)],
  ];
  need(ctx, 34);
  const colW = CONTENT_W / cols.length;
  cols.forEach(([k, v], i) => {
    const x = M + colW * i;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(k.toUpperCase(), x, ctx.y, { charSpace: 0.8 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(v, colW - 8) as string[], x, ctx.y + 14);
  });
  ctx.y += 34;
  rule(ctx);

  /* checklist */
  tick(ctx, "Same-day field check");
  paragraph(
    ctx,
    `Tailored to this water${job ? ` and to a ${jobLabel.toLowerCase()} day` : ""}. Every line is an action you take, not a condition we claim to know.`,
    { size: 8.5, color: MUTED },
  );
  ctx.y += 6;
  for (const g of CHECK_GROUPS) {
    const group = items.filter((i) => i.group === g);
    if (group.length === 0) continue;
    need(ctx, 46);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(...INK);
    ctx.doc.text(g.toUpperCase(), M, ctx.y, { charSpace: 0.6 });
    ctx.y += 16;
    for (const i of group) checkbox(ctx, i.text, i.source);
    ctx.y += 6;
  }

  rule(ctx);

  /* layer digest */
  tick(ctx, "Layer digest");
  for (const l of layers) {
    need(ctx, 44);
    paragraph(ctx, l.title, { style: "bold", size: 10 });
    paragraph(ctx, l.readout, { size: 9 });
    paragraph(
      ctx,
      `Confidence ${l.confidence}% · ${l.unknowns.length} residual unknown${l.unknowns.length === 1 ? "" : "s"}`,
      { size: 7.5, color: MUTED },
    );
    ctx.y += 6;
  }

  rule(ctx);

  /* access, launches and logistics */
  tick(ctx, "Access & launches");
  paragraph(ctx, access.readout, { size: 9 });
  if (access.sites.length) {
    ctx.y += 4;
    for (const s of access.sites) {
      need(ctx, 26);
      const status =
        s.open === false
          ? " — DOCUMENTED CLOSED"
          : s.statusLabel
            ? ` — ${s.statusLabel}`
            : "";
      paragraph(ctx, `${s.name} (${s.typeLabel})${status}`, { size: 9 });
      if (s.amenities.length) {
        paragraph(ctx, s.amenities.join(" · "), {
          size: 7.5,
          color: MUTED,
          indent: 12,
        });
      }
    }
  }
  if (access.logistics.length) {
    ctx.y += 6;
    tick(ctx, "Logistics named on the source");
    paragraph(ctx, access.logistics.map((l) => l.label).join(" · "), { size: 9 });
  }
  paragraph(
    ctx,
    "An amenity that is not listed is one the source did not publish, not one that is absent. Gate hours, fees and same-day closures are set locally.",
    { size: 7.5, color: MUTED },
  );

  rule(ctx);

  /* reading the water — craft, not observation */
  tick(ctx, `Reading this water — ${read.waterClass}`);
  paragraph(ctx, read.headline, { style: "bold", size: 10 });
  paragraph(ctx, read.summary, { size: 9 });
  paragraph(
    ctx,
    "Standing craft for this class of water. Not an observation of this water today: no clarity, temperature, level, flow, tide or hatch is held here, and no spot is named.",
    { size: 7.5, color: MUTED },
  );
  if (read.shaped.length) {
    ctx.y += 6;
    tick(ctx, "What this record changes about the read");
    for (const s of read.shaped) paragraph(ctx, `— ${s}`, { size: 9 });
  }
  ctx.y += 6;
  tick(ctx, "What to look for");
  for (const c of cuesFor(read, level)) {
    need(ctx, 40);
    paragraph(ctx, c.title, { style: "bold", size: 9.5 });
    paragraph(ctx, c.what, { size: 8.5 });
    paragraph(ctx, `Why: ${c.why}`, { size: 8.5, color: MUTED });
    paragraph(ctx, `Find it: ${c.look}`, { size: 8.5, color: MUTED });
    ctx.y += 4;
  }

  rule(ctx);

  tick(ctx, "Recorded hazard families");
  paragraph(ctx, t.hazards.size ? [...t.hazards].map(humanize).join(", ") : "None recorded.");
  ctx.y += 8;
  tick(ctx, "Capacity pressure");
  paragraph(ctx, t.crowd.size ? [...t.crowd].map(humanize).join(", ") : "None recorded.");
  ctx.y += 8;
  tick(ctx, "Species context");
  paragraph(ctx, d.speciesContext.length ? d.speciesContext.join(", ") : "None recorded.");
  ctx.y += 8;
  tick(ctx, "Season windows");
  {
    const dated = datedWindows(d);
    if (dated.length === 0) {
      paragraph(
        ctx,
        "No dated harvest closure published at the official source used for this record. Empty windows are a completed check, not a gap. Do not assume harvest is open. Confirm on the official page.",
      );
    } else {
      for (const w of dated) {
        paragraph(
          ctx,
          `${windowSpan(w) ?? ""}  ${w.label}${w.notes ? ` — ${w.notes}` : ""}`,
          { size: 9 },
        );
      }
    }
  }
  if (d.provenanceNotes) {
    ctx.y += 8;
    tick(ctx, "Provenance");
    paragraph(ctx, d.provenanceNotes, { size: 8.5, color: MUTED });
  }
  const tags = catalogTags(d);
  if (tags.length) {
    ctx.y += 8;
    tick(ctx, "Catalog tags");
    paragraph(ctx, tags.map(tagLabel).join(", "));
  }
  ctx.y += 8;
  tick(ctx, "Official source");
  paragraph(ctx, d.officialSourceUrl, { size: 8.5, color: MUTED });
  ctx.y += 8;
  tick(ctx, "Managing agency");
  paragraph(ctx, d.managingAgency || "Not recorded from the cited source.");
  if (d.officialRegsUrl) {
    ctx.y += 8;
    tick(ctx, "Official regulations");
    paragraph(ctx, d.officialRegsUrl, { size: 8.5, color: MUTED });
  }

  rule(ctx);

  tick(ctx, "Boundary and limitations");
  paragraph(
    ctx,
    "Public, named destinations only. This brief contains no private spots, no coordinates, no catch expectation, and no live gauge, flow, tide, weather or hatch data. Conditions and regulations change without notice; the official source above governs. If a check cannot be cleared, the correct answer is not to go.",
    { size: 8.5, color: MUTED },
  );
}

function fileSafe(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function downloadPacketPdf(
  d: Destination,
  job: JobId | null = null,
  level: ReadLevel = "working",
) {
  const doc = newDoc();
  const issued = new Date().toISOString().slice(0, 10);
  const ctx: Ctx = { doc, y: M, page: 1, issued };
  record(ctx, d, job, level);
  footer(ctx);
  doc.setProperties({
    title: `Field brief — ${displayName(d)}`,
    subject: "Field Sense Navigator field brief",
    creator: "Field Sense Navigator",
  });
  doc.save(`field-packet-${fileSafe(displayName(d))}-${issued}.pdf`);
}

/** Shortlist export: contents page, then one record per page run. */
export function downloadShortlistPdf(
  list: Destination[],
  job: JobId | null = null,
  level: ReadLevel = "working",
) {
  if (list.length === 0) return;
  if (list.length === 1) return downloadPacketPdf(list[0]!, job, level);

  const doc = newDoc();
  const issued = new Date().toISOString().slice(0, 10);
  const ctx: Ctx = { doc, y: M, page: 1, issued };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("FIELD SENSE NAVIGATOR", M, ctx.y, { charSpace: 1.4 });
  ctx.y += 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text("Shortlist brief", M, ctx.y);
  ctx.y += 10;
  rule(ctx, 12);
  paragraph(
    ctx,
    `${list.length} named public waters carried forward on ${issued}. Each record below is reproduced in full, in order.`,
    { size: 9.5, color: MUTED },
  );
  ctx.y += 10;
  tick(ctx, "Contents");
  list.forEach((d, i) => {
    const r = readiness(d);
    paragraph(
      ctx,
      `${String(i + 1).padStart(2, "0")}   ${displayName(d)} — ${d.state} · readiness ${r.score}/100 (${r.band})`,
      { size: 9.5 },
    );
  });

  for (const d of list) {
    breakPage(ctx);
    record(ctx, d, job, level);
  }
  footer(ctx);
  doc.setProperties({
    title: `Shortlist brief — ${list.length} waters`,
    creator: "Field Sense Navigator",
  });
  doc.save(`field-packet-shortlist-${issued}.pdf`);
}
