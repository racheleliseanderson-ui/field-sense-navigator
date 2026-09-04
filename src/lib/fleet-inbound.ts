/**
 * Reading what a sibling instrument carried back here.
 *
 * Field Sense sits at the top of the Hook workflow, so most people arrive with
 * nothing attached and that is the ordinary case. But the workflow is a loop,
 * not a line: somebody following a "re-check this water" link from the Field
 * Ops Desk is part way round that loop rather than starting cold, and making
 * them retype the water they already chose is the thing the packet exists to
 * prevent.
 *
 * This logic used to live entirely inside `<CarriedContext>`, which meant the
 * only inbound reader in this application had no seam: it could not be run
 * against a packet without mounting a component, and so it never was. Every
 * other instrument in the fleet tests what it reads. This one could not, and
 * the two defects below had been sitting in it:
 *
 *   · A declared job was looked up in this catalog's own job list and, on a
 *     miss, vanished. No banner, no note, nothing — indistinguishable from a
 *     packet that declared no job at all. Now that a job says what KIND it is,
 *     "a job of a kind this instrument does not rank by" gets its own answer.
 *
 *   · A packet naming a water this catalog does not hold was reported as "no
 *     record with that id", which is true and unhelpful. What a reader wants
 *     at that point is the search, and the search needs the NAME — which is
 *     carried, and was being used only in the prose.
 *
 * Nothing here applies anything to the page. It builds what a reader is
 * offered; the reader takes it or ignores it. A tool that silently rearranged
 * itself around a URL fragment would be harder to trust than one that shows
 * its work.
 */

import {
  FLEET_TARGETS,
  assessFreshness,
  jobKindOf,
  toolKeyOf,
  type HthPacket,
  type JobKind,
  type PacketRead,
} from "@/lib/hth-packet";
import { destinationById, displayName } from "@/lib/catalog";
import { JOBS, type JobId } from "@/lib/intelligence";
import type { Destination } from "@/lib/catalog";

/** What this instrument means by a job: how you are getting on the water. */
export const THIS_INSTRUMENT_JOB_KIND: JobKind = "access";

export type CarriedJob =
  /** A job this catalog ranks by. The offer is a ranked plan. */
  | { state: "ranked"; id: JobId; label: string }
  /**
   * A real job of a kind this instrument does not rank by — a workflow stage,
   * a fishing job. Worth naming, and not worth offering a plan for.
   */
  | { state: "other-kind"; kind: JobKind; label: string }
  /** A job id this catalog does not hold and whose kind was never declared. */
  | { state: "unknown"; label: string };

export type CarriedContext =
  | { state: "absent" }
  | { state: "invalid"; reason: string }
  | {
      state: "read";
      /** The sender, as a person would say it. */
      from: string;
      packet: HthPacket;
      /** The catalog record, when the carried water is one this catalog holds. */
      record: Destination | undefined;
      /** The water's name, from the packet or from the record it resolved to. */
      waterName: string | null;
      job: CarriedJob | null;
      /** Non-null only when it changes what to do about the packet's age. */
      staleNote: string | null;
      normalizations: string[];
    };

/**
 * Whose name to put on the banner.
 *
 * `toolKeyOf` resolves whatever identity actually arrived — a fleet name, or a
 * bare instrument id from a sender that emitted no `origin`. An id this fleet
 * has not registered falls through to the raw string rather than being guessed
 * at, which is a worse label but an honest one.
 */
export function senderLabel(packet: HthPacket): string {
  const key = toolKeyOf(packet);
  const target = key ? Object.values(FLEET_TARGETS).find((t) => t.toolKey === key) : undefined;
  if (target) return target.name;
  const raw = packet.fleet?.lastUpdatedBy ?? packet.origin;
  return typeof raw === "string" && raw.trim() ? raw : "an earlier step";
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * What to do with a declared job.
 *
 * The order matters. A job whose id this catalog ranks by is taken first, even
 * if the kind is absent — a packet built before `kind` existed is still a
 * perfectly good packet, and refusing it on a missing field would be a
 * regression dressed up as rigour. Only after that miss does the kind decide
 * between "not mine to rank" and "I have no idea what this is".
 */
export function readJob(packet: HthPacket): CarriedJob | null {
  const raw = packet.job;
  if (!raw || typeof raw !== "object") return null;
  const id = text((raw as { id?: unknown }).id);
  const label = text((raw as { label?: unknown }).label);
  if (!id && !label) return null;

  const known = id ? JOBS.find((j) => j.id === id) : undefined;
  if (known) return { state: "ranked", id: known.id as JobId, label: known.label };

  const kind = jobKindOf(raw as { kind?: unknown });
  if (kind && kind !== THIS_INSTRUMENT_JOB_KIND) {
    return { state: "other-kind", kind, label: label ?? id ?? "a job" };
  }
  return { state: "unknown", label: label ?? id ?? "a job" };
}

export function readCarriedContext(read: PacketRead | null): CarriedContext {
  if (!read || read.state === "absent") return { state: "absent" };
  if (read.state === "invalid") return { state: "invalid", reason: read.reason };

  const packet = read.packet;
  const waterId = text(packet.water?.waterId);
  const record = waterId ? destinationById(waterId) : undefined;
  const waterName = text(packet.water?.waterName) ?? (record ? displayName(record) : null);

  /* Age is measured from the trail, not from a build stamp any sender may or
     may not have written. Shown only when it changes what to do. */
  const freshness = assessFreshness(packet);

  return {
    state: "read",
    from: senderLabel(packet),
    packet,
    record,
    waterName,
    job: readJob(packet),
    staleNote: freshness.severity === "clear" ? null : freshness.detail,
    normalizations: read.normalizations,
  };
}
