import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, RefreshCw, ChevronDown } from "lucide-react";
import { getLiveConditions } from "@/lib/live.functions";
import type { Destination } from "@/lib/catalog";

function formatAsOf(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown time";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Optional official sensor context. OFF by default.
 * Only fetches when the user explicitly expands the panel AND the record
 * carries at least one station ID. Never a bite or behaviour forecast.
 */
export function LiveConditions({ destination }: { destination: Destination }) {
  const [open, setOpen] = useState(false);
  const call = useServerFn(getLiveConditions);

  const hasStation =
    Boolean(destination.usgsSiteId?.trim()) ||
    Boolean(destination.noaaCoopsStationId?.trim()) ||
    Boolean(destination.ndbcBuoyId?.trim());

  const { data, isLoading, isFetching, refetch, isError } = useQuery({
    queryKey: [
      "live",
      destination.id,
      destination.usgsSiteId,
      destination.noaaCoopsStationId,
      destination.ndbcBuoyId,
    ],
    queryFn: () =>
      call({
        data: {
          usgsSiteId: destination.usgsSiteId ?? null,
          noaaCoopsStationId: destination.noaaCoopsStationId ?? null,
          ndbcBuoyId: destination.ndbcBuoyId ?? null,
          state: destination.state,
          waterbody: destination.waterbody,
        },
      }),
    enabled: open && hasStation,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return (
    <div className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brass" aria-hidden="true" />
          <p className="tick text-brass">Official readings</p>
        </div>
        {open && hasStation && (
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Refresh official readings"
            className="tap grid h-9 w-9 place-items-center text-muted-foreground hover:text-brass disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {!open && (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Live gauge, water level and wind readings are available only when you
            request them. They are raw station observations, never a bite or
            behaviour forecast.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 inline-flex min-h-10 items-center gap-2 border border-hairline px-4 text-xs uppercase tracking-[0.12em] text-foreground hover:border-brass/50"
          >
            Show official readings
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {open && !hasStation && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          No official station ID is mapped to this record. Nothing nearby is
          substituted. Verify conditions directly through the agency source.
        </p>
      )}

      {open && hasStation && isLoading && (
        <div className="mt-5 space-y-3" aria-live="polite">
          <div className="shimmer h-3 w-2/3" />
          <div className="shimmer h-3 w-1/2" />
          <div className="shimmer h-10 w-full" />
        </div>
      )}

      {open && hasStation && isError && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          The official feeds could not be reached. Treat this water as unmonitored
          and verify conditions directly.
        </p>
      )}

      {open && hasStation && data && (
        <>
          {data.station ? (
            <p className="mt-4 text-sm leading-relaxed text-foreground">
              {data.station.agency} station{" "}
              <span className="data text-brass">{data.station.id}</span> —{" "}
              {data.station.name}
            </p>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Mapped station returned no current identity. Readings below (if
              any) carry their source ID.
            </p>
          )}

          {data.readings.length > 0 && (
            <dl className="mt-5 space-y-3">
              {data.readings.map((r) => (
                <div key={`${r.label}-${r.sourceId}`} className="border-l border-brass/50 pl-3">
                  <dt className="tick text-[0.55rem] text-brass">{r.label}</dt>
                  <dd className="data mt-1 text-lg text-foreground">
                    {r.value}
                    <span className="ml-1 text-xs text-muted-foreground">{r.unit}</span>
                  </dd>
                  <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                    as of {formatAsOf(r.observedAt)} · {r.sourceId}
                  </p>
                </div>
              ))}
            </dl>
          )}

          {data.attribution.length > 0 && (
            <p className="mt-4 text-[0.65rem] leading-relaxed text-muted-foreground">
              Sources: {data.attribution.join(" · ")}
              {data.attribution.some((a) => a.includes("Open-Meteo"))
                ? " · Weather data by Open-Meteo.com (CC-BY 4.0)"
                : ""}
            </p>
          )}

          <ul className="mt-5 space-y-2">
            {data.unknowns.map((u) => (
              <li
                key={u}
                className="flex gap-3 text-xs leading-relaxed text-muted-foreground"
              >
                <span className="mt-1.5 h-px w-4 shrink-0 bg-alert" />
                {u}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
