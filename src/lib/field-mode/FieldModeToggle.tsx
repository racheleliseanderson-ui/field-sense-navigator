import { FIELD_MODE_LABEL, FIELD_MODE_NOTE, useFieldMode } from "./index";

/**
 * The control, and it is one button on purpose.
 *
 * A segmented three-way control is the obvious design and the wrong one: it
 * costs three targets across the top of a screen where every pixel is already
 * spoken for, to expose a setting most people change twice a year. One button
 * that cycles, with its current state written on it, does the same job in a
 * third of the width.
 *
 * It says which state it is in rather than which state pressing it produces,
 * because the reader is standing up and needs to know where they are before
 * they need to know what happens next.
 */
export function FieldModeToggle({ className }: { className?: string | undefined }) {
  const { setting, active, byGuess, cycle } = useFieldMode();

  return (
    <button
      type="button"
      onClick={cycle}
      data-active={active ? "true" : "false"}
      className={`hth-field-toggle ${className ?? ""}`.trim()}
      title={FIELD_MODE_NOTE[setting]}
      aria-label={`Reading mode: ${FIELD_MODE_LABEL[setting]}${
        byGuess ? ", field layout because the screen is small" : ""
      }. ${FIELD_MODE_NOTE[setting]} Press to change.`}
    >
      <span className="hth-field-toggle__dot" aria-hidden="true" />
      <span>{FIELD_MODE_LABEL[setting]}</span>
    </button>
  );
}
