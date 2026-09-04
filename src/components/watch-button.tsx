import { Bookmark, BookmarkCheck } from "lucide-react";
import { useWatchlist } from "@/lib/watchlist";

/** Add or remove a water from the watchlist without leaving the view. */
export function WatchButton({
  id,
  name,
  variant = "icon",
  className = "",
}: {
  id: string;
  name: string;
  variant?: "icon" | "full";
  className?: string;
}) {
  const { has, toggle } = useWatchlist();
  const on = has(id);

  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(id);
  };

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={click}
        aria-pressed={on}
        className={`tap inline-flex min-h-12 items-center justify-center gap-2 border px-5 text-xs uppercase tracking-[0.14em] transition-colors ${
          on
            ? "border-brass/60 bg-selected text-selected-foreground"
            : "border-hairline text-foreground hover:border-brass/50"
        } ${className}`}
      >
        {on ? (
          <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Bookmark className="h-4 w-4" aria-hidden="true" />
        )}
        {on ? "On watchlist" : "Watch this water"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`}
      className={`tap grid h-11 w-11 shrink-0 place-items-center border border-hairline transition-colors ${
        on
          ? "border-brass/60 bg-selected text-selected-foreground"
          : "text-muted-foreground hover:text-brass"
      } ${className}`}
    >
      {on ? (
        <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Bookmark className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
