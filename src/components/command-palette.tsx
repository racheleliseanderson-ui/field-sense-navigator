import { useNavigate } from "@tanstack/react-router";
import { Command } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { destinations, displayName, states } from "@/lib/catalog";

const ROUTES = [
  { to: "/plan", label: "Plan a day" },
  { to: "/explore", label: "Catalog" },
  { to: "/compare", label: "Compare waters" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/pipeline", label: "How a decision comes together" },
  { to: "/boundary", label: "Limits & sources" },
] as const;

/** Keyboard jump: waters, states and sections of the site. Cmd/Ctrl-K. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const waters = useMemo(
    () => destinations.map((d) => ({ id: d.id, label: displayName(d), state: d.state })),
    [],
  );

  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open quick search"
        className="tap hidden h-11 items-center gap-2 border border-hairline bg-panel/60 px-3 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground hover:border-brass/50 md:inline-flex"
      >
        <Command className="h-3.5 w-3.5" aria-hidden="true" />
        Jump
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a water, a state, or a section" />
        <CommandList>
          <CommandEmpty>No water on record carries that name. Try a state, a county or a species.</CommandEmpty>
          <CommandGroup heading="Sections">
            {ROUTES.map((r) => (
              <CommandItem
                key={r.to}
                value={r.label}
                onSelect={() => go(() => navigate({ to: r.to }))}
              >
                {r.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="States">
            {states.map((s) => (
              <CommandItem
                key={s}
                value={`state ${s}`}
                onSelect={() =>
                  go(() => navigate({ to: "/explore", search: { state: s } as never }))
                }
              >
                {s} — catalog
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Waters">
            {waters.map((w) => (
              <CommandItem
                key={w.id}
                value={`${w.label} ${w.state}`}
                onSelect={() =>
                  go(() => navigate({ to: "/water/$id", params: { id: w.id } }))
                }
              >
                <span className="truncate">{w.label}</span>
                <span className="ml-auto text-[0.65rem] text-muted-foreground">{w.state}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
