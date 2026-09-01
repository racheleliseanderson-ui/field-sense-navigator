const SUPPORT_URL =
  "https://www.buymeacoffee.com/northernlanternhouse?utm_source=hookthehorizon&utm_medium=footer&utm_campaign=bmc_support";

/**
 * Native, first-party support link mounted at the bottom of the document.
 * The legacy component name is retained so root shells do not need risky churn.
 * No Buy Me a Coffee JavaScript is loaded and nothing floats over app controls.
 */
export function BuyMeACoffeeWidget() {
  return (
    <aside
      aria-label="Support Hook the Horizon"
      className="no-print"
      data-print="hide"
      style={{
        borderTop: "1px solid rgba(128, 128, 128, 0.22)",
        padding: "0.8rem 1rem max(0.9rem, env(safe-area-inset-bottom))",
        textAlign: "center",
      }}
    >
      <a
        id="nlh-bmc-footer-link"
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label="Support the field notes on Buy Me a Coffee; opens in a new tab"
        style={{
          color: "inherit",
          display: "inline-block",
          fontSize: "0.75rem",
          lineHeight: 1.5,
          opacity: 0.72,
          textDecoration: "none",
        }}
      >
        Support the field notes <span aria-hidden="true">↗</span>
      </a>
    </aside>
  );
}
