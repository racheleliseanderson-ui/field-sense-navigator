import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { destinationById, displayName } from "@/lib/catalog";
import { JOBS, type JobId } from "@/lib/intelligence";
import {
  FLEET_TARGETS,
  assessFreshness,
  readPacket,
  toolKeyOf,
  type HthPacket,
  type PacketRead,
} from "@/lib/hth-packet";

/**
 * What a reader brought back with them.
 *
 * Field Sense is the first step in the Hook workflow, so most people arrive
 * here with nothing attached and that is the ordinary case. But the workflow is
 * a loop, not a line: the Field Ops Desk emits a packet now, and somebody
 * following a "re-check this water" link back to the catalog is part way round
 * that loop rather than starting cold. Making them retype the water they
 * already chose is the thing the packet exists to prevent.
 *
 * Nothing is applied to the page on its own. The packet pre-selects a water and
 * a job by offering them as the pressable thing on screen — a link the reader
 * takes or ignores. A tool that silently rearranged the page around a URL
 * fragment would be harder to trust than one that shows its work.
 */

/**
 * Whose name to put on the banner.
 *
 * `toolKeyOf` resolves whatever identity actually arrived — a fleet name, or a
 * bare instrument id from a sender that emitted no `origin`. An id this fleet
 * has not registered falls through to the raw string rather than being guessed
 * at, which is a worse label but an honest one.
 */
function senderLabel(packet: HthPacket): string {
  const key = toolKeyOf(packet);
  const target = key ? Object.values(FLEET_TARGETS).find((t) => t.toolKey === key) : undefined;
  if (target) return target.name;
  const raw = packet.fleet?.lastUpdatedBy ?? packet.origin;
  return typeof raw === "string" && raw.trim() ? raw : "an earlier step";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="carried-heading"
      data-print="hide"
      className="border-b border-hairline bg-panel/60"
    >
      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">{children}</div>
    </section>
  );
}

export function CarriedContext() {
  /*
   * The fragment only exists in a browser, and a server render that guessed at
   * it would disagree with the first client render. Reading it after mount
   * means the page is never wrong — it is briefly silent, which is the truth
   * until the fragment has been looked at.
   */
  const [read, setRead] = useState<PacketRead | null>(null);
  useEffect(() => setRead(readPacket(window.location.hash)), []);

  if (!read) return null;

  /*
   * State one of three: nothing was offered. Not an error, and not worth a
   * banner — an empty notice on every visit would train people to skip the one
   * visit it matters on. The other two states both render.
   */
  if (read.state === "absent") return null;

  /*
   * State two: something was offered and could not be honoured. This is the
   * state the fleet used to collapse into silence, which meant a failed carry
   * looked exactly like a carry nobody attempted. It says so instead, in the
   * reason string the shared module writes for showing to a person.
   */
  if (read.state === "invalid") {
    return (
      <Shell>
        <p className="tick text-watch">Context did not carry</p>
        <h2
          id="carried-heading"
          className="mt-3 font-display text-xl font-bold tracking-[-0.03em] text-foreground sm:text-2xl"
        >
          Something was attached to that link, and it did not read.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {read.reason}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The catalog itself is unaffected. Start from a search or a declared job below, or go back
          to the tool you came from and follow its handoff link rather than a copied address.
        </p>
      </Shell>
    );
  }

  /* State three: a packet arrived, was version-gated, stripped and normalised. */
  const packet = read.packet;
  const waterId = typeof packet.water?.waterId === "string" ? packet.water.waterId : null;
  const record = waterId ? destinationById(waterId) : undefined;
  const carriedName =
    (typeof packet.water?.waterName === "string" ? packet.water.waterName : null) ??
    (record ? displayName(record) : null);
  const jobId = typeof packet.job?.id === "string" ? (packet.job.id as JobId) : null;
  const job = jobId ? JOBS.find((j) => j.id === jobId) : undefined;
  const from = senderLabel(packet);
  const freshness = assessFreshness(packet);

  return (
    <Shell>
      <p className="tick text-brass">Carried from {from}</p>
      <h2
        id="carried-heading"
        className="mt-3 font-display text-xl font-bold tracking-[-0.03em] text-foreground sm:text-2xl"
      >
        {record && carriedName
          ? `${carriedName} came across with that link.`
          : carriedName
            ? `That link named ${carriedName}.`
            : "That link carried context, but no water."}
      </h2>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {record ? (
          <>
            The record is already on this catalog, so nothing needs retyping.
            {job ? ` A ${job.label.toLowerCase()} day came across with it.` : ""} Nothing has been
            applied to this page on its own — open the record and it picks up where you left it.
          </>
        ) : carriedName ? (
          <>
            No record with that id is on this catalog, so there is nothing here to open. That
            usually means the water is named somewhere else in the fleet rather than here. Searching
            the name is the next thing worth trying.
            {job ? ` The declared job (${job.label.toLowerCase()}) still carried across.` : ""}
          </>
        ) : (
          <>
            The packet read cleanly and named no water, so there is nothing to pre-select.
            {job ? ` The declared job (${job.label.toLowerCase()}) did carry across.` : ""}
          </>
        )}
      </p>

      {/* Age is measured from the trail, not from a build stamp any sender may
          or may not have written. Shown only when it changes what to do. */}
      {freshness.severity !== "clear" && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-watch">{freshness.detail}</p>
      )}

      {/* A repair is reported, never performed quietly. */}
      {read.normalizations.length > 0 && (
        <ul className="mt-3 max-w-2xl space-y-1 text-[0.78rem] leading-relaxed text-dim-foreground">
          {read.normalizations.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {record && (
          <Link
            to="/water/$id"
            params={{ id: record.id }}
            className="tap inline-flex min-h-12 items-center border border-brass/60 bg-selected px-5 text-xs uppercase tracking-[0.14em] text-selected-foreground hover:bg-selected/85"
          >
            Open {carriedName}
          </Link>
        )}
        {job && (
          <Link
            to="/plan"
            search={{ job: job.id }}
            className="tap inline-flex min-h-12 items-center border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
          >
            Rank waters for a {job.label.toLowerCase()} day
          </Link>
        )}
        {!record && carriedName && (
          <Link
            to="/explore"
            search={{ q: carriedName }}
            className="tap inline-flex min-h-12 items-center border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
          >
            Search the catalog for {carriedName}
          </Link>
        )}
      </div>
    </Shell>
  );
}
