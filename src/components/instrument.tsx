import type { Grade, IntelLayer, Readiness } from "@/lib/intelligence";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useCountUp } from "@/lib/motion";

const GRADE_TEXT: Record<Grade, string> = {
  clear: "text-clear",
  watch: "text-watch",
  flagged: "text-flagged",
  restricted: "text-alert",
};

const GRADE_BG: Record<Grade, string> = {
  clear: "bg-clear",
  watch: "bg-watch",
  flagged: "bg-flagged",
  restricted: "bg-alert",
};

const GRADE_WORD: Record<Grade, string> = {
  clear: "Clear",
  watch: "Watch",
  flagged: "Flagged",
  restricted: "Restricted",
};

/**
 * A distinct shape per signal so status never depends on hue alone —
 * circle / triangle / square / diamond, readable under any color vision.
 */
const GRADE_SHAPE: Record<Grade, string> = {
  clear: "rounded-full",
  watch: "[clip-path:polygon(50%_0,100%_100%,0_100%)]",
  flagged: "",
  restricted: "rotate-45",
};

export function GradeChip({ grade, label }: { grade: Grade; label?: string }) {
  return (
    <span
      data-signal={grade}
      className="inline-flex items-center gap-2 border border-hairline px-2.5 py-1"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 ${GRADE_BG[grade]} ${GRADE_SHAPE[grade]}`}
      />
      <span className={`tick text-[0.6rem] ${GRADE_TEXT[grade]}`}>
        {label ?? GRADE_WORD[grade]}
      </span>
      <span className="sr-only">{GRADE_WORD[grade]}</span>
    </span>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[3px] w-full bg-border/60">
        <div
          className="absolute inset-y-0 left-0 bg-primary"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="data shrink-0 text-[0.7rem] text-muted-foreground">
        {value}%
      </span>
    </div>
  );
}

export function ReadinessMeter({
  readiness,
  compact = false,
}: {
  readiness: Readiness;
  compact?: boolean;
}) {
  const { score, band, grade, parts } = readiness;
  const dashes = 40;
  const [shown, ref] = useCountUp(score);
  const lit = Math.round((shown / 100) * dashes);

  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className={compact ? "" : "panel p-6"}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="tick">Field readiness</p>
          <p className="data mt-1 text-5xl font-semibold leading-none text-foreground">
            {shown}
            <span className="ml-1 text-lg text-muted-foreground">/100</span>
          </p>
        </div>
        <GradeChip grade={grade} label={band} />
      </div>

      <div className="mt-5 flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: dashes }).map((_, i) => (
          <span
            key={i}
            className={`h-6 flex-1 transition-colors duration-300 ${
              i < lit ? GRADE_BG[grade] : "bg-border/50"
            } ${i < lit ? "opacity-90" : ""}`}
            style={i < lit ? { opacity: 0.35 + (i / dashes) * 0.65 } : undefined}
          />
        ))}
      </div>

      {!compact && (
        <dl className="mt-6 space-y-4">
          {parts.map((p) => (
            <div key={p.label}>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-foreground">{p.label}</dt>
                <dd className="data text-sm text-muted-foreground">
                  {p.value}
                  <span className="opacity-50">/{p.max}</span>
                </dd>
              </div>
              <div className="mt-1.5 h-[2px] w-full bg-border/50">
                <div
                  className="h-full bg-brass"
                  style={{ width: `${(p.value / p.max) * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {p.note}
              </p>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function LayerPanel({
  layer,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
}: {
  layer: IntelLayer;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const toggle = () => {
    if (onToggle) onToggle();
    else setUncontrolledOpen((v) => !v);
  };

  return (
    <div className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="group flex w-full items-start gap-3 py-5 text-left sm:gap-4 sm:py-6"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
              {layer.title}
            </span>
            <GradeChip grade={layer.grade} />
          </span>
          <span className="mt-2 block max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {layer.readout}
          </span>
          <span className="mt-3 flex w-full max-w-xs items-center gap-3">
            <span className="tick text-[0.55rem]">Confidence</span>
            <span className="flex-1">
              <ConfidenceBar value={layer.confidence} />
            </span>
          </span>
        </span>
        <ChevronDown
          className={`mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-7 pb-8 sm:pl-8 md:grid-cols-2">
          <div>
            <p className="tick">What the record says</p>
            <ul className="mt-3 space-y-3">
              {layer.signals.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nothing is recorded here for this water yet.
                </li>
              )}
              {layer.signals.map((s, i) => (
                <li key={i} className="border-l border-brass/50 pl-3">
                  <p className="tick text-[0.55rem] text-brass">{s.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {s.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="tick">What this read cannot tell you</p>
            <ul className="mt-3 space-y-2.5">
              {layer.unknowns.map((u, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                >
                  <span className="mt-2 h-px w-4 shrink-0 bg-border" />
                  {u}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="panel relative overflow-hidden p-6">
      <div className="shimmer h-3 w-24" />
      <div className="shimmer mt-4 h-6 w-3/4" />
      <div className="shimmer mt-3 h-3 w-1/2" />
      <div className="shimmer mt-6 h-12 w-full" />
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel relative overflow-hidden px-8 py-20 text-center">
      <div className="hairline-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center border border-brass/40">
          <span className="h-2 w-2 rounded-full bg-brass" />
        </div>
        <h3 className="mt-6 font-display text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        {action && <div className="mt-7 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
