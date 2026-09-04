import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { readPacket, type PacketRead } from "@/lib/hth-packet";
import { readCarriedContext } from "@/lib/fleet-inbound";

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

  const carried = readCarriedContext(read);

  /*
   * State one of three: nothing was offered. Not an error, and not worth a
   * banner — an empty notice on every visit would train people to skip the one
   * visit it matters on. The other two states both render.
   */
  if (carried.state === "absent") return null;

  /*
   * State two: something was offered and could not be honoured. This is the
   * state the fleet used to collapse into silence, which meant a failed carry
   * looked exactly like a carry nobody attempted. It says so instead, in the
   * reason string the shared module writes for showing to a person.
   */
  if (carried.state === "invalid") {
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
          {carried.reason}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The catalog itself is unaffected. Start from a search or a declared job below, or go back
          to the tool you came from and follow its handoff link rather than a copied address.
        </p>
      </Shell>
    );
  }

  /* State three: a packet arrived, was version-gated, stripped and normalised. */
  const { record, waterName, job, from } = carried;

  return (
    <Shell>
      <p className="tick text-brass">Carried from {from}</p>
      <h2
        id="carried-heading"
        className="mt-3 font-display text-xl font-bold tracking-[-0.03em] text-foreground sm:text-2xl"
      >
        {record && waterName
          ? `${waterName} came across with that link.`
          : waterName
            ? `That link named ${waterName}.`
            : "That link carried context, but no water."}
      </h2>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {record ? (
          <>
            The record is already on this catalog, so nothing needs retyping.
            {job?.state === "ranked" ? ` A ${job.label.toLowerCase()} day came across with it.` : ""}{" "}
            Nothing has been applied to this page on its own — open the record and it picks up where
            you left it.
          </>
        ) : waterName ? (
          <>
            No record with that id is on this catalog, so there is nothing here to open. That
            usually means the water is named somewhere else in the fleet rather than here. Searching
            the name is the next thing worth trying.
            {job?.state === "ranked"
              ? ` The declared job (${job.label.toLowerCase()}) still carried across.`
              : ""}
          </>
        ) : (
          <>
            The packet read cleanly and named no water, so there is nothing to pre-select.
            {job?.state === "ranked"
              ? ` The declared job (${job.label.toLowerCase()}) did carry across.`
              : ""}
          </>
        )}
      </p>

      {/*
        A job of a kind this catalog does not rank by used to disappear here
        without a word, which is indistinguishable from a packet that declared
        no job at all. It is named instead — the sender was not wrong to send
        it, and this instrument is not wrong to leave it alone.
      */}
      {job?.state === "other-kind" && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          That link also carried{" "}
          <span className="text-foreground">{job.label.toLowerCase()}</span> — a{" "}
          {job.kind === "stage" ? "point in the fishing day" : "fishing job"} rather than a way of
          getting on the water. This catalog ranks by access, so it is carried through untouched
          rather than used here.
        </p>
      )}

      {job?.state === "unknown" && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A job called <span className="text-foreground">{job.label}</span> came across and this
          catalog does not hold one by that name. It is left alone rather than matched to the
          nearest thing.
        </p>
      )}

      {/* Age is measured from the trail, not from a build stamp any sender may
          or may not have written. Shown only when it changes what to do. */}
      {carried.staleNote && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-watch">{carried.staleNote}</p>
      )}

      {/* A repair is reported, never performed quietly. */}
      {carried.normalizations.length > 0 && (
        <ul className="mt-3 max-w-2xl space-y-1 text-[0.78rem] leading-relaxed text-dim-foreground">
          {carried.normalizations.map((note) => (
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
            Open {waterName}
          </Link>
        )}
        {job?.state === "ranked" && (
          <Link
            to="/plan"
            search={{ job: job.id }}
            className="tap inline-flex min-h-12 items-center border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
          >
            Rank waters for a {job.label.toLowerCase()} day
          </Link>
        )}
        {!record && waterName && (
          <Link
            to="/explore"
            search={{ q: waterName }}
            className="tap inline-flex min-h-12 items-center border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
          >
            Search the catalog for {waterName}
          </Link>
        )}
      </div>
    </Shell>
  );
}
