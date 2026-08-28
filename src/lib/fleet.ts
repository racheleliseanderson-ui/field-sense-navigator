/**
 * Northern Lantern House fleet link registry — Fleet Shell Standard v1 §5.
 *
 * SINGLE SOURCE OF TRUTH. This file is byte-identical across every app in the
 * fleet; only `THIS_APP` below differs per app. Do not enumerate cross-app
 * links anywhere else in the application.
 *
 * Every URL here was resolved live on 2026-08-28. When you add or move an
 * instrument, update this file in every repo in the same pass — a drifted
 * footer is how the fleet stops looking like one company.
 *
 * Known traps, verified 2026-08-28:
 *   - Support is /customer-support, NOT /support (that path 404s).
 *   - Elsewhere, Apparently is a PUBLICATION on the house domain. Its
 *     instruments are The Money, Apparently and The Trip Clock. Linking the
 *     publication name at money.northernlanternhouse.com (or at the retired
 *     the-money-apparently.vercel.app, which 302s) is wrong on both counts.
 */

export const HOUSE_URL = "https://northernlanternhouse.com";
export const HOUSE_NAME = "Northern Lantern House Labs";
export const HOUSE_LEGAL_URL = `${HOUSE_URL}/legal-accessibility`;
export const HOUSE_SUPPORT_URL = `${HOUSE_URL}/customer-support`;

export type FleetLink = { name: string; url: string };
export type FleetGroup = { publication: FleetLink; apps: FleetLink[] };

export const SALTY: FleetGroup = {
  publication: { name: "Salty & Clever", url: "https://saltnotes.blog" },
  apps: [
    { name: "Salty Desk", url: "https://salty.saltnotes.blog" },
    { name: "Kitchen & Bar", url: "https://kitchen.saltnotes.blog" },
    { name: "Occasion OS", url: "https://occasion.saltnotes.blog" },
    { name: "Menu Builder", url: "https://occasion.saltnotes.blog/architecture" },
    { name: "Restaurant Intelligence", url: "https://deepdish.saltnotes.blog" },
  ],
};

export const THISTLE: FleetGroup = {
  publication: { name: "Tangled Thistle", url: "https://tangledthistle.blog" },
  apps: [
    { name: "Atmosphere OS", url: "https://atmosphere.tangledthistle.blog" },
    { name: "Thistle Pulse", url: "https://pulse.tangledthistle.blog" },
    { name: "Venue Intelligence", url: "https://venue.tangledthistle.blog" },
  ],
};

export const VANITY: FleetGroup = {
  publication: { name: "Vanity or Vice", url: "https://vanityvice.blog" },
  apps: [
    { name: "Makeup Intelligence", url: "https://makeup.vanityvice.blog" },
    { name: "Skincare Desk", url: "https://skincare.vanityvice.blog" },
    { name: "Spa Intelligence", url: "https://spa.vanityvice.blog" },
  ],
};

export const DRAMA: FleetGroup = {
  publication: { name: "Room for Drama", url: "https://dramaroom.blog" },
  apps: [
    { name: "Room Pulse", url: "https://dramaroom.blog/room-pulse" },
    { name: "Room Lab", url: "https://dramaroom.blog/room-lab" },
  ],
};

export const HORIZON: FleetGroup = {
  publication: { name: "Hook the Horizon", url: "https://hookthehorizon.blog" },
  apps: [
    { name: "Field Ops Desk", url: "https://ops.hookthehorizon.blog" },
    { name: "Field Sense Navigator", url: "https://waterways.hookthehorizon.blog" },
    { name: "Species & Presentation", url: "https://species.hookthehorizon.blog" },
    { name: "Hatch Match", url: "https://hatch.hookthehorizon.blog" },
    { name: "Tackle Link Analyst", url: "https://tackle.hookthehorizon.blog" },
    { name: "Rig Signal", url: "https://rig-signal.hookthehorizon.blog" },
    { name: "Knot Analyst", url: "https://knot.hookthehorizon.blog" },
  ],
};

export const ELSEWHERE: FleetGroup = {
  publication: { name: "Elsewhere, Apparently", url: `${HOUSE_URL}/elsewhere-apparently` },
  apps: [
    { name: "The Money, Apparently", url: "https://money.northernlanternhouse.com" },
    { name: "The Trip Clock", url: "https://clock.northernlanternhouse.com" },
  ],
};

/** Every publication in the house, in house order. */
export const PUBLICATIONS: FleetGroup[] = [
  SALTY,
  THISTLE,
  VANITY,
  DRAMA,
  HORIZON,
  ELSEWHERE,
];

/** The app rendering this footer. Its entry gets aria-current and no link-out. */
export const THIS_APP = "Field Sense Navigator";

/** This app's own publication — rendered in the "This publication" column. */
export const THIS_PUBLICATION: FleetGroup = HORIZON;

/** Everything except this app's publication — the "Across the fleet" column. */
export const ACROSS_FLEET: FleetGroup[] = PUBLICATIONS.filter(
  (g) => g.publication.url !== THIS_PUBLICATION.publication.url,
);
