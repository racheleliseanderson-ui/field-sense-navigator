# Precision Field Planner

Improve this existing live application: https://honey-hole-intelligence.vercel.app/

https://github.com/racheleliseanderson-ui/honey-hole-intelligence     Upgrade Field Sense Navigator into a high-end field intelligence instrument while strictly preserving the public-waters-only, no-private-spots, fail-closed philosophy.

Intelligence upgrades:

- Add a true multi-layer intelligence engine for each waterbody: Access & Legality, Conditions & Hazards, Capacity & Crowding signals, Seasonal/Regulatory pressure, and Field-Check requirements. Each layer must show confidence and residual unknowns.

- Situation-aware ranking: let the user declare a job (bank, kayak, small boat, scouting, tournament-adjacent, family, etc.) + constraints (time window, gear limitations, wind tolerance, etc.). Rank and surface waters that actually fit the job instead of pure alphabetical/catalog listing.

- Introduce a lightweight “Field Readiness Score” that is transparent about what it can and cannot know (never invent live gauge or hatch data).

- Smarter field-check engine: generate a concise, printable same-day checklist tailored to the specific water + job + known risks.

Visual & experience upgrades (high-end):

- Transform from dense catalog list into a refined instrument. Hero area should feel like a precision tool, not a database browser.

- Destination cards become elegant, scannable instruments with clear visual hierarchy, subtle status language, and progressive disclosure of layers.

- Beautiful empty and loading states. Premium PDF export of a waterbody “Field Packet” that looks like a high-end briefing document.

Workflow upgrades:

- Guided “Plan a day” path that starts with job + constraints, then surfaces ranked waters, then produces a ready-to-print field packet.

- Keep the ability to freely explore the full catalog, but make exploration feel luxurious rather than overwhelming.

- Explicit “Carry this water forward” handoff to Horizon Desk / Trip Prep.

Do not add private spots, exact coordinates, catch guarantees, or live real-time claims that cannot be verified. Keep the tone precise, honest, and field-first.

Use the current live version as the baseline. Do not start from scratch — elevate what already exists.

This project was built with [Lovable](https://lovable.dev).

Scheduled ingest lives in GitHub Actions (`.github/workflows/ingest-live.yml` and `ingest-critical.yml`) and publishes `snapshot.json` + `status.json` to the `live-snapshot` branch. Interior-west / override / NOAA CO-OPS gauges refresh every 10 minutes; the full catalog every 30. USBR is isolated so a RISE timeout cannot stall USGS or NOAA. The last 24 hourly snapshots are kept under `archive/`. The app consumes that snapshot fail-closed.

**Live app**: https://field-sense-navigator.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1fd2d7e7-c4b5-4d21-903f-3ccf64463ed4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
