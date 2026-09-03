/** Print the catalog record count and nothing else, so a shell can capture it. */
import { readCatalog } from "./lib.mjs";
process.stdout.write(String(readCatalog().length));
