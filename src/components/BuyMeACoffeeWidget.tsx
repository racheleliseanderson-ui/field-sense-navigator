import { useEffect } from "react";

const BMC_SELECTOR =
  'script[data-name="BMC-Widget"][data-id="northernlanternhouse"]';

/**
 * Loads the Buy Me a Coffee widget only after the primary app UI has settled.
 * The floating control is intentionally omitted below 1024px so it cannot
 * cover the mobile action docks used throughout the Hook the Horizon tools.
 */
export function BuyMeACoffeeWidget() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    if (document.querySelector(BMC_SELECTOR)) return;

    const timer = window.setTimeout(() => {
      if (document.querySelector(BMC_SELECTOR)) return;

      const script = document.createElement("script");
      script.src = "https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js";
      script.async = true;
      script.setAttribute("data-name", "BMC-Widget");
      script.setAttribute("data-cfasync", "false");
      script.setAttribute("data-id", "northernlanternhouse");
      script.setAttribute("data-description", "Keep a light on the water");
      script.setAttribute(
        "data-message",
        "Cast one more line. Tips keep the field notes honest.",
      );
      script.setAttribute("data-color", "#2E6F95");
      script.setAttribute("data-position", "Right");
      script.setAttribute("data-x_margin", "18");
      script.setAttribute("data-y_margin", "18");
      document.body.appendChild(script);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
