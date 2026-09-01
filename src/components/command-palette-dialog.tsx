import { useNavigate } from "@tanstack/react-router";

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
  { to: "/", label: "Check a water" },
  { to: "/plan", label: "Plan a day" },
  { to: "/explore", label: "Catalog" },
  { to: "/compare", label: "Compare waters" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/pipeline", label: "How a decision comes together" },
  { to: "/boundary", label: "Limits & sources" },
] as const;

/**
 * The palette body. Loaded on first open only — cmdk and the dialog primitive
 * are a large dependency to put on the critical path of every page for a
 * control most visits never press.
 */
export default function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();

  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a water, a state, or a section" />
      <CommandList>
        <CommandEmpty>No record carries that name.</CommandEmpty>
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
        <CommandGroup heading="States, provinces & territories">
          {states.map((s) => (
            <CommandItem
              key={s}
              value={`state ${s}`}
              onSelect={() => go(() => navigate({ to: "/explore", search: { state: s } as never }))}
            >
              {s} — catalog
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Waters">
          {destinations.map((d) => (
            <CommandItem
              key={d.id}
              value={`${displayName(d)} ${d.state}`}
              onSelect={() => go(() => navigate({ to: "/water/$id", params: { id: d.id } }))}
            >
              <span className="truncate">{displayName(d)}</span>
              <span className="ml-auto text-[0.65rem] text-muted-foreground">{d.state}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
