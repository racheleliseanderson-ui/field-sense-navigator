/**
 * Hook the Horizon — shared field plates.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk at
 * src/lib/field-plates/. Edit there, then run `node scripts/sync-fleet-shared.mjs`.
 *
 * Importing this module brings the stylesheet with it, so an app adopts the
 * whole kit with one import and no CSS wiring.
 */

import "./field-plates.css";

export * from "./kit";
export * from "./water-section";
export * from "./presentation-path";
export * from "./system-chain";
export * from "./rig-schematic";
export * from "./load-path";
export * from "./forage-silhouette";
export * from "./season-band";
