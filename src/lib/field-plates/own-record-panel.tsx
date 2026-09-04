import type { HistoryBlock, HistoryNote } from "../hth-packet";

/**
 * Hook the Horizon — the angler's own record, as a receiver shows it.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk at
 * src/lib/field-plates/. Edit it there and run `node scripts/sync-fleet-shared.mjs`.
 *
 * Field Ops is the end of the chain and the debrief was a sink: a person wrote
 * down what happened and the six instruments that were each answering a slice
 * of the question went on knowing nothing about the four times that person had
 * already stood on that bank. The packet now carries a small honest piece of
 * that record forward, and this is the frame every receiver puts it in — one
 * frame, so it reads the same in Waterways as in Species, and so no instrument
 * can quietly restyle somebody's own words into its own advice.
 *
 * Three things this panel does on purpose:
 *
 *  1. IT SAYS WHOSE IT IS, TWICE. In the heading and in the closing line. A
 *     sentence in the app's own typeface, unattributed, becomes the app's
 *     sentence within about one screen.
 *  2. IT SAYS THE INSTRUMENT DID NOT USE IT. Because the instrument did not.
 *     Four trips is four trips; an instrument that leaned its recommendation
 *     toward them would be a bite predictor with a diary, and the whole fleet
 *     is built on not being that. Saying so out loud is what stops a reader
 *     assuming the answer above already accounts for their history.
 *  3. IT QUOTES. Never summarises, never re-punctuates, never truncates in the
 *     middle of a sentence and calls it a highlight. The protocol clamps the
 *     length; what arrives is shown.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * `2026-09-06` → `6 Sep 2026`.
 *
 * Formatted by hand rather than through `Intl`, because these apps render on a
 * server in one timezone and hydrate in another, and a date that formats
 * differently in the two places is a hydration mismatch on somebody's phone.
 * Anything that is not a plain ISO day is passed through untouched.
 */
export function recordDay(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return raw;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return raw;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** The dateline: day, what was fished, the water it was fished in. */
export function noteLine(note: HistoryNote): string {
  return [
    recordDay(note.on),
    (note.presentation ?? "").trim() || null,
    (note.clarity ?? "").trim() || null,
    (note.season ?? "").trim() || null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/**
 * How many trips, in words, without a number pretending to be a sample size.
 *
 * "Four trips" is a fact. "Four trips (67% on streamers)" would be this fleet
 * growing the thing it promised not to grow.
 */
export function recordHeadline(record: HistoryBlock): string {
  const trips = record.entries === 1 ? "One trip" : `${record.entries} trips`;
  const scope = (record.scope ?? "").trim();
  return scope ? `${trips} of your own on ${scope}.` : `${trips} of your own on record.`;
}

export function OwnRecordPanel({
  record,
  from,
  instrument,
}: {
  record?: HistoryBlock | null | undefined;
  /** The instrument the record travelled from. Named, never implied. */
  from?: string | undefined;
  /** This instrument, for the line saying it did not use any of this. */
  instrument?: string | undefined;
}) {
  if (!record || record.entries < 1) return null;

  return (
    <section className="hthp-own" data-testid="own-record">
      <div className="hthp-own__head">
        <p className="hthp-eyebrow">Your own record</p>
        {from ? <p className="hthp-own__from">carried from {from}</p> : null}
      </div>
      <p className="hthp-own__headline">{recordHeadline(record)}</p>

      {/*
       * Every trip that travelled, including the ones with nothing written on
       * them. What you fished on a day you wrote nothing about is still a fact
       * you put there, and dropping those days would make the list quietly
       * disagree with the count beneath it.
       */}
      {record.notes.length ? (
        <ul className="hthp-own__list">
          {record.notes.map((note, index) => (
            <li key={`${note.on ?? "n"}-${index}`} className="hthp-own__entry">
              <p className="hthp-own__meta">{noteLine(note)}</p>
              {(note.said ?? "").trim() ? (
                <blockquote className="hthp-own__said">{note.said}</blockquote>
              ) : (
                <p className="hthp-own__note hthp-own__note--tight">Nothing written down.</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hthp-own__note">
          Nothing written down on those trips. The count is all that travelled.
        </p>
      )}

      {/*
       * What the link left behind, counted against the notes that TRAVELLED
       * rather than against the ones that were quotable. A trip with nothing
       * written on it still came across; saying otherwise would tell somebody
       * they have a trip on file that they are, in fact, looking at.
       */}
      {record.entries > record.notes.length ? (
        <p className="hthp-own__note">
          {record.entries - record.notes.length === 1
            ? "One more trip on record that did not travel with this link."
            : `${record.entries - record.notes.length} more trips on record that did not travel with this link.`}
        </p>
      ) : null}

      <p className="hthp-own__disclaimer">
        {instrument
          ? `${instrument} did not use any of this`
          : "This instrument did not use any of it"}
        . It is here because you wrote it, and because you are the only one who can say whether it
        applies today.
      </p>
    </section>
  );
}
