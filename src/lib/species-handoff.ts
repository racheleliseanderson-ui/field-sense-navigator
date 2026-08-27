import { displayName, type Destination, type WaterType } from "@/lib/catalog";

export const SPECIES_URL = "https://species.hookthehorizon.blog/";

export function mapWaterType(waterType: WaterType): "flowing" | "stillwater" | undefined {
  if (waterType === "river") return "flowing";
  if (waterType === "lake" || waterType === "reservoir") return "stillwater";
  return undefined;
}

/** Public-safe Field Sense → Species packet. Named water only; no coordinates, no auto-POST. */
export function encodeSpeciesPacket(d: Destination): string {
  const waterType = mapWaterType(d.waterType);
  const packet = {
    packetVersion: "HTH-1.0",
    origin: "field-sense",
    createdAt: new Date().toISOString(),
    instrumentId: "HTH-HH-001",
    water: {
      waterId: d.id,
      waterName: displayName(d),
      waterType,
      jurisdiction: [d.county, d.state].filter(Boolean).join(", "),
      documentedSpecies: d.speciesContext,
      accessContext: d.status,
    },
    conditions: {
      waterType,
      tempF: null,
      tempSource: "unknown",
    },
    privacy: {
      containsCoordinates: false,
      containsPrivateWater: false,
    },
  };
  return SPECIES_URL + "#packet=" + encodeURIComponent(JSON.stringify(packet));
}
