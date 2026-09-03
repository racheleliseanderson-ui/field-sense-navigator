# HTH-1.0 — the fleet packet contract

Seven Hook the Horizon applications pass context to each other in a URL
fragment. `src/lib/hth-packet.ts` is the single shared implementation of that
contract. It is **copied verbatim into all seven repositories** — there is no
monorepo and no package — so it has zero imports outside the standard library.

Chain: **Water → Species → Forage/Hatch → Presentation → Tackle → Knot → Field
Ops → Debrief.** Presentation has no application of its own; Species &
Presentation owns it. Debrief is the closing step of Field Ops. **Rig Signal is
an optional device-validation sidecar** — it may be entered from and returned to
any step, and nothing downstream may require it.

---

## 1. The shape

```jsonc
{
  "packetVersion": "HTH-1.0",          // required, gated
  "origin": "field-sense",             // the sender's own name for itself
  "intent": "species",                 // advisory: which step it was built for
  "createdAt": "2026-09-02T14:00:00.000Z",  // when THIS hop built it
  "instrumentId": "HTH-HH-001",
  "fleet": {                           // required, gated
    "contract": "HTH-FLEET-1.0",
    "trail": [{ "origin": "field-sense", "at": "2026-09-02T14:00:00.000Z" }],
    "lastUpdatedBy": "field-sense"
  },
  "water": {
    "waterId", "waterName", "waterType", "waterClass", "region", "state",
    "jurisdiction", "documentedSpecies": [], "selectedSpecies",
    "accessContext", "managingAgency", "officialSourceUrl"
  },
  "reading":   { "waterClass", "headline", "cues": [{ "family", "title" }], "shaped": [] },
  "logistics": { "namedSites", "directoryOnly", "trailerLaunch", "handLaunch",
                 "shoreAccess", "amenitiesPublished": [] },
  "job":       { "id", "label" },       // or null
  "readiness": { "score", "band" },
  "openChecks": [],
  "conditions": {
    "waterType",
    "tempF", "tempUnit", "tempSource", "tempObservedAt", "tempRetained", "tempStation",
    "airTempF", "airTempSource", "airTempObservedAt", "airTempRetained", "airTempStation"
    // plus the optional wider vocabulary: tempRangeF, flow, stillState,
    // tideMovement, tideStrength, clarity, light, weather, season, holding
  },
  "provenance": [{ "source", "evidenceClass", "reviewedAt", "ageDays",
                   "humanReviewedAt", "humanReviewedBy", "nextReviewAt", "builtAt" }],
  "privacy": { "containsCoordinates": false, "containsPrivateWater": false }
}
```

Every block is optional except `packetVersion` and `fleet`. **Unknown blocks
travel untouched** — `claimEvaluation` (Rig Signal), `tackleEvaluation` (Tackle
Link), `knotDecision` (Knot Analyst), `hypotheses` and
`presentationRequirements` (Species) all ride the same envelope without any
other repo shipping a new version of this file.

Two separations are load-bearing:

- **Water temperature is never air temperature.** `tempF` and `airTempF` are
  separate fields so no instrument can read one as the other. `null` is the
  honest answer when no official station published a reading; the packet never
  estimates, interpolates, or borrows from a neighbouring water.
- **`reviewedAt` is not `builtAt`.** Provenance describes the record's own
  source check; `builtAt` is when the packet was assembled. Conflating them
  tells every downstream instrument that a month-old record was verified this
  morning.

---

## 2. The version rule

`packetVersion` must equal `HTH-1.0` **and** `fleet.contract` must equal
`HTH-FLEET-1.0`. Anything else — including a packet that declares neither — is
rejected with a reason string suitable for showing a user. A packet with no
declared version is not "probably fine"; half-reading one is how a field with a
familiar name and a different meaning gets silently adopted.

One documented exception: the **Hatch Match legacy stamp**
(`applicationId: "HTH-**-***"` + `schemaVersion`, no envelope) is lifted into
the envelope, and every repair is reported in `read.normalizations` so a caller
can show exactly what was assumed. Nothing is repaired silently.

## 3. The trail rule

`fleet.trail` **appends. It never replaces.** It is the route the context
actually travelled, the only provenance that survives a five-app chain, and the
field `packetAge()` measures. An emitter that writes `trail: [{ origin: me }]`
erases the route and resets the clock, so a packet that has sat in a tab for six
hours looks brand new to the next receiver.

`buildPacket()` is the only place trail entries are constructed. Pass the
incoming packet (or the `readPacket()` result directly) as `incoming` and it
merges every block over what arrived, appends one hop, and accumulates
provenance.

**Age comes from the last trail entry, not from `createdAt`.** The Field Ops
Desk read `createdAt`, which several senders do not emit, so its freshness gate
resolved to "no reliable timestamp" forever. `createdAt` is a fallback only.

## 4. The coordinate rule

`stripCoordinates()` removes every coordinate-shaped key, recursively, inside
arrays, at any depth — `coordinates, coordinate, coord, coords, lat, lng, lon,
latitude, longitude, gps, geo, geojson, geometry, bbox, centroid, point,
position, location, waypoint, pin`. Matching is on the **key** only, so the
holding class `point` and the season `spring` travel untouched.

It runs **on read as well as on write**. Stripping only on write assumes every
sender runs this file; six of seven did not. Stripping on read is what stops a
receiver adopting a stranger's `lat`/`lon`, persisting it, and re-emitting it
from a code path that never saw the original packet. `privacy` is the sender's
*claim* — show it if you like, never rely on it.

## 5. The three-state read

```ts
readPacket(input?)  // never throws
//  { state: "absent" }                                    no packet offered
//  { state: "invalid", code, reason, raw }                offered, not honoured
//  { state: "ok", packet, normalizations: string[] }      offered and read
```

A failed carry must never look like a carry that never happened. Collapsing
`absent` and `invalid` into `null` is exactly what let the base64url dialect
fail unnoticed across the fleet. `reason` is written to be shown to a person.

`readPacket` accepts a whole URL, a bare fragment, or nothing (it reads
`location.hash`), finds `packet=` anywhere among `&`-separated fragment
parameters, and decodes **both** fleet dialects: URI-encoded JSON *and*
base64url. It only ever **writes** URI-encoded JSON, so no application that
adopts this file can spread a third dialect.

---

## 6. Copying it into your repo

1. **Copy the file.**
   `field-sense-navigator/src/lib/hth-packet.ts` → `<your-repo>/src/lib/hth-packet.ts`.
   Copy `src/lib/__tests__/hth-packet.test.ts` alongside it (adjust the import
   specifier and the test runner import to whatever your repo uses).
   Change nothing else in the file. It has no `@/` imports and no npm
   dependencies by design; if you find yourself adding one, the thing you are
   adding is app-specific and belongs in your app.

2. **Wire the read.** Wherever you currently parse the fragment, replace it:

   ```ts
   const read = readPacket();               // or readPacket(window.location.hash)
   if (read.state === "invalid") showBanner(read.reason);   // never silent
   if (read.state === "ok") applyIncoming(read.packet, read.normalizations);
   ```

   Keep your own `applyIncoming` — which fields your instrument adopts is your
   business, and naming the ones you decline on screen is a good habit
   (Rig Signal's `declined` list is the model).

3. **Wire the write.**

   ```ts
   const packet = buildPacket({
     origin: "your-instrument",
     instrumentId: "HTH-XX-001",
     intent: "tackle",
     incoming: read,                 // pass the read result straight in
     conditions: { ... },
     provenance: [ ... ],
     blocks: { yourEvaluation },     // your instrument-specific block
   });
   const href = packetUrl("tackle", packet);
   ```

   Build from the **original** incoming packet on every render, never from your
   own previous output — that is the one way to grow a trail without bound.

4. **Delete, once the above is live:** your local `BLOCKED_KEYS` set and
   `sanitize*` walker, your local `parseFleetPacket` / `readFleetHandoff` /
   `parseIncomingPacket` fragment decoder, your local `encodePacketHash`, your
   local copy of `CARRY_WINDOW_MS`, and your hard-coded list of fleet URLs.
   Import `stripCoordinates`, `readPacket`, `encodePacketHash`,
   `CARRY_WINDOW_MS` and `FLEET_TARGETS` from this file instead.
   **Keep** everything that maps packet fields onto your own domain vocabulary —
   that is yours, not the protocol's.

5. **Specific to each repo:**
   - `field-ops-desk` — replace the `createdAt`-based age in
     `assessmentFor()` with `assessFreshness(packet)`; that is the fix for the
     freshness gate that never resolved.
   - `field-guide-craft` (Hatch Match) — stop writing base64url
     (`encodePacket`), emit `encodePacketHash()`, and emit the real envelope
     instead of `applicationId` / `schemaVersion`. The legacy repair here is a
     bridge, not a destination.
   - `horizon-signal-craft` (Rig Signal) — its `protocol.ts` is where most of
     this came from; keep `buildClaimEvaluation` and the `readCarried` mapping,
     replace only the envelope, decode, sanitize and target plumbing.
   - `species-presentation-analyst` — `carryFleetContext` becomes
     `buildPacket({ incoming, ... })`.
   - `tackle-link-analyst`, `knot-horizon-craft` — same substitution; both
     already have the right shape, just a private copy of it.

6. **Do not** change `PACKET_VERSION`, `FLEET_CONTRACT`, the trail rule, or the
   coordinate denylist in one repo only. Any change to those is a protocol
   change: edit this file, re-copy it to all seven, and bump the version.
