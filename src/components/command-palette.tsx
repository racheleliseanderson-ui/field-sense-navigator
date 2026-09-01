import { Command } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";

const CommandPaletteDialog = lazy(() => import("@/components/command-palette-dialog"));

/**
 * Keyboard jump: waters, jurisdictions and instrument sections. Cmd/Ctrl-K.
 *
 * Only the trigger and the shortcut are on the critical path; the palette
 * itself is fetched the first time it is opened.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setMounted(true);
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        aria-label="Open the jump palette"
        title="Jump to a water (Ctrl/Cmd-K)"
        className="tap hidden h-11 items-center gap-2 border border-hairline bg-panel/60 px-3 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground hover:border-brass/50 md:inline-flex"
      >
        <Command className="h-3.5 w-3.5" aria-hidden="true" />
        Jump
      </button>

      {mounted && (
        <Suspense fallback={null}>
          <CommandPaletteDialog open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
