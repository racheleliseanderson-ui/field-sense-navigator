import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Columns3 } from "lucide-react";
import { displayName, daysSince, humanize, reviewOverdue, catalogTags, tagLabel, datedWindows, type Destination } from "@/lib/catalog";
import { readTags, readiness, type Fit } from "@/lib/intelligence";
import { GradeChip } from "@/components/instrument";
import { WatchButton } from "@/components/watch-button";
import { useCompareTray } from "@/lib/compare-tray";
import { plateFor, CARD } from "@/lib/imagery";

function CompareButton({ id, name }: { id: string; name: string }) {
  const { has, toggle, full } = useCompareTray();
  const on = has(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      aria-pressed={on}
      disabled={!on && full}
      aria-label={on ? `Remove ${name} from the comparison` : `Add ${name} to the comparison`}
      className={`tap grid h-11 w-11 shrink-0 place-items-center border border-hairline bg-card/80 backdrop-blur transition-colors disabled:opacity-40 ${
        on ? "border-brass/60 bg-brass/15 text-brass" : "text-muted-foreground hover:text-brass"
      }`}
    >
      <Columns3 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function TypeMark({ type }: { type: string }) {
  return (
    <span className="tick text-[0.55rem] text-brass">{type}</span>
  );
}

export function WaterCard({
  destination,
  fit,
  rank,
  art = false,
}: {
  destination: Destination;
  fit?: Fit;
  rank?: number;
  /** show the water-type plate as a masthead strip */
  art?: boolean;
}) {
  const plate = plateFor(destination.waterType);
  const r = fit?.readiness ?? readiness(destination);
  const t = readTags(destination);
  const overdue = reviewOverdue(destination);
  const age = daysSince(destination.checkedAt);
  const dated = datedWindows(destination);
  const layerCounts = [
    { k: "Access", v: destination.publicAccess.length },
    { k: "Hazards", v: t.hazards.size },
    { k: "Capacity", v: t.crowd.size },
    { k: "Windows", v: dated.length },
    { k: "Checks", v: destination.directVerification.length },
  ];

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <CompareButton id={destination.id} name={displayName(destination)} />
        <WatchButton
          id={destination.id}
          name={displayName(destination)}
          className="bg-card/80 backdrop-blur"
        />
      </div>
    <Link
      to="/water/$id"
      params={{ id: destination.id }}
      className={`panel lift group relative block overflow-hidden ${art ? "pt-0" : ""} p-6`}
    >
      {art && (
        <div aria-hidden="true" className="relative -mx-6 mb-5 h-36 overflow-hidden sm:h-40">
          <img
            src={plate.src}
            srcSet={plate.srcSet}
            sizes={CARD}
            alt=""
            width={2400}
            height={1355}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="image-treated h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]"
            style={{ objectPosition: plate.position }}
          />
          <div className="absolute inset-0 bg-linear-to-t from-card via-card/35 to-transparent" />
          <div className="grain absolute inset-0" />
        </div>
      )}
      <div className="flex items-start justify-between gap-4 pr-[6.5rem]">
        <div className="flex items-center gap-3">
          {typeof rank === "number" && (
            <span className="data text-xs text-brass">
              {String(rank).padStart(2, "0")}
            </span>
          )}
          <TypeMark type={destination.waterType} />
          <span className="data text-[0.65rem] text-muted-foreground">
            {destination.id}
          </span>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brass" />
      </div>

      <h3 className="mt-4 font-display text-xl font-bold leading-tight tracking-tight text-foreground">
        {displayName(destination)}
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {destination.region} · {destination.state}
      </p>

      <div className="mt-5 flex items-center gap-3">
        <span className="data text-2xl font-semibold text-foreground">
          {fit ? fit.score : r.score}
        </span>
        <div className="flex-1">
          <p className="tick text-[0.55rem]">
            {fit ? "Job fit" : "Field readiness"}
          </p>
          <div className="mt-1.5 h-[2px] w-full bg-border/60">
            <div
              className="h-full bg-primary"
              style={{ width: `${fit ? fit.score : r.score}%` }}
            />
          </div>
        </div>
        <GradeChip grade={r.grade} label={r.band} />
      </div>

      {overdue && (
        <p className="mt-3 text-xs font-medium leading-relaxed text-alert">
          Review overdue — this record is past {destination.nextReviewAt}. Treat it as not-go until the official source is re-read.
        </p>
      )}

      {fit && (fit.reasons.length > 0 || fit.cautions.length > 0) && (
        <ul className="mt-4 space-y-1.5">
          {fit.reasons.slice(0, 2).map((x, i) => (
            <li key={`r${i}`} className="flex gap-2 text-xs leading-relaxed text-foreground/85">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-clear" />
              {x}
            </li>
          ))}
          {fit.cautions.slice(0, 2).map((x, i) => (
            <li key={`c${i}`} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-watch" />
              {x}
            </li>
          ))}
        </ul>
      )}

      {!fit && destination.currentNotices[0] && (
        <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {destination.currentNotices[0]}
        </p>
      )}

      <dl className="rule-top mt-5 grid grid-cols-5 gap-1 pt-4">
        {layerCounts.map((l) => (
          <div key={l.k}>
            <dt className="tick text-[0.5rem]">{l.k}</dt>
            <dd className="data mt-1 text-sm text-foreground/90">{l.v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[0.65rem] text-muted-foreground">
        {humanize(destination.status)}
        {" · "}
        Last source check: {age === 0 ? "today" : `${age}d ago`}
        {" · "}
        {dated.length
          ? `${dated.length} dated closure${dated.length === 1 ? "" : "s"}`
          : "no dated closure published"}
      </p>
      {destination.managingAgency && (
        <p className="mt-1 truncate text-[0.65rem] text-muted-foreground/90">
          {destination.managingAgency}
        </p>
      )}
      {catalogTags(destination).length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Catalog tags">
          {catalogTags(destination)
            .filter((t) => t !== destination.waterType)
            .slice(0, 4)
            .map((t) => (
              <li
                key={t}
                className="border border-hairline bg-background/60 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.08em] text-muted-foreground"
              >
                {tagLabel(t)}
              </li>
            ))}
        </ul>
      )}
    </Link>
    </div>
  );
}

export function BlockedCard({ fit }: { fit: Fit }) {
  const d = fit.destination;
  return (
    <div className="border border-alert/30 bg-card/50 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-base font-bold text-foreground">
          {displayName(d)}
        </p>
        <GradeChip grade="restricted" label="Excluded" />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {fit.blocked}
      </p>
      <Link
        to="/water/$id"
        params={{ id: d.id }}
        className="tick mt-3 inline-block text-[0.55rem] text-primary hover:text-brass"
      >
        Read the record →
      </Link>
    </div>
  );
}
