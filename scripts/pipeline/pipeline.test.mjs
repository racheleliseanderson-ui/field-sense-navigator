/**
 * The gates, not the plumbing.
 *
 * Every test here is a claim the catalog must never make: a tourism site
 * believed, a park page filed as a water, a page that names a different lake
 * accepted, a robots rule read backwards. Network behaviour is deliberately
 * untested -- an agency being slow is not a bug in this repository.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  trustTier,
  isTrusted,
  waterTokens,
  waterKey,
  pageNamesWater,
  pageCarriesPhrase,
  pageReadsAsWater,
  stripHtml,
  sentences,
  sitemapLocs,
  isSitemapIndex,
  mainText,
  isMultiStateHost,
} from "./lib.mjs";
import {
  publishedName,
  stripDesignation,
  chooseWaterbodyName,
  waterTypeFrom,
  accessFrom,
  noticesFrom,
  speciesFrom,
  tagsFrom,
  boilerplateFilter,
  namesADocumentOrPlace,
  refuseAsWaterbodyName,
} from "./extract.mjs";

test("trust: agencies are believed, tourism boards are not", () => {
  assert.equal(trustTier("https://wdfw.wa.gov/fishing/x"), "government");
  assert.equal(trustTier("https://myfwc.com/fishing/x"), "government");
  assert.equal(
    trustTier("https://gis.myfwc.com/x"),
    "government",
    "a subdomain of an agency is the agency",
  );
  assert.equal(trustTier("https://www2.gov.bc.ca/x"), "government");
  assert.equal(trustTier("https://mffp.gouv.qc.ca/x"), "government");
  assert.equal(trustTier("https://pinellascounty.org/x"), "government", "a county is government");
  assert.equal(trustTier("https://ncwildlife.org/x"), "authority");
  assert.equal(trustTier("https://visitcorpuschristi.com/x"), "untrusted");
  assert.equal(trustTier("https://tripadvisor.com/x"), "untrusted");
  assert.equal(trustTier("https://lakelubbers.com/x"), "untrusted");
  assert.equal(isTrusted("https://example.com"), false);
  assert.equal(trustTier("not a url"), "untrusted");
});

test("names: the class word never carries the identity", () => {
  assert.deepEqual(waterTokens("Lake Washington"), ["washington"]);
  assert.deepEqual(waterTokens("North Fork Snoqualmie River"), ["snoqualmie"]);
  assert.equal(waterKey("Lake Erie", "Ohio"), waterKey("lake erie", "OHIO"));
  assert.notEqual(waterKey("Lake Erie", "Ohio"), waterKey("Lake Erie", "New York"));
});

test("naming: a page about another lake is not this lake", () => {
  const page = "Cooper Lake State Park offers camping and fishing on Cooper Lake.";
  assert.equal(pageCarriesPhrase(page, "Cooper Lake"), true);
  assert.equal(pageCarriesPhrase(page, "Caddo Lake"), false);
  assert.equal(pageNamesWater(page, "Caddo Lake"), false);
});

test("naming: apostrophes and accents do not break a match", () => {
  assert.equal(pageCarriesPhrase("Devil's Lake is open.", "Devils Lake"), true);
  assert.equal(pageCarriesPhrase("Lac Témiscouata", "Lac Temiscouata"), true);
});

test("subject: a page has to be about fishing this water", () => {
  assert.equal(pageReadsAsWater("Boat launch and fishing pier open daily."), true);
  assert.equal(pageReadsAsWater("Board meeting minutes for the quarter."), false);
});

test("published name: site furniture is cut, the water is kept", () => {
  const html = "<h1>Lake Arrowhead State Park</h1>";
  assert.equal(publishedName(html, "ignored"), "Lake Arrowhead State Park");
  assert.equal(
    publishedName("<p>no heading</p>", "Caddo Lake — Texas Parks & Wildlife Department"),
    "Caddo Lake",
  );
  assert.equal(stripDesignation("Caddo Lake State Park"), "Caddo Lake");
  assert.equal(
    stripDesignation("Lake Casa Blanca International State Park"),
    "Lake Casa Blanca International",
  );
  assert.equal(stripDesignation("Flathead Lake"), "Flathead Lake", "a real name is left alone");
});

test("the record names the water, not the park on it", () => {
  const page = "Caddo Lake State Park sits on Caddo Lake, where anglers fish for bass.";
  assert.equal(chooseWaterbodyName("Caddo Lake", "Caddo Lake State Park", page), "Caddo Lake");
});

test("a park with no water in its name is refused, not guessed at", () => {
  const page = "Big Spring State Park has a scenic overlook and picnic tables.";
  assert.equal(chooseWaterbodyName("Big Spring", "Big Spring State Park", page), null);
});

test("a name the page never uses is refused", () => {
  const page = "Cooper State Park has camping and trails and fishing access.";
  assert.equal(chooseWaterbodyName("Cooper Lake", "Cooper State Park", page), null);
});

test("water class comes from the published name", () => {
  assert.equal(waterTypeFrom("Lake Livingston"), "lake");
  assert.equal(waterTypeFrom("Flaming Gorge Reservoir"), "reservoir");
  assert.equal(waterTypeFrom("Devils River"), "river");
  assert.equal(waterTypeFrom("Barnegat Bay"), "marine");
  assert.equal(
    waterTypeFrom("Somewhere Meadow", ""),
    null,
    "an undeclared class is null, not a guess",
  );
});

test("access: only what the page published, and named where it said a name", () => {
  const named = accessFrom(
    "Kenmore Boat Launch\nSeward Park Fishing Pier\nsome prose about the lake",
    "Lake Washington",
  );
  assert.equal(named.length, 2);
  assert.equal(named[0].name, "Kenmore Boat Launch");
  assert.equal(named[0].type, "boat_launch");
  assert.equal(named[1].type, "fishing_pier");
  assert.ok(named.every((a) => a.officiallyPublished === true));

  const summary = accessFrom(
    "The park has a boat ramp and bank fishing along the shoreline.",
    "Some Lake",
  );
  assert.equal(summary.length, 1);
  assert.equal(summary[0].type, "boat_launch_and_shore_access");

  assert.deepEqual(
    accessFrom("A quiet page with no facilities mentioned at all.", "Some Lake"),
    [],
    "no access mentioned is an empty list, never an invented ramp",
  );
});

test("notices: the agency's wording, and never a denial of a closure", () => {
  const text = [
    "The north boat ramp is closed for construction until spring.",
    "There are no current closures on this lake.",
    "A fish consumption advisory applies to largemouth bass.",
  ].join("\n");
  const notices = noticesFrom(text);
  assert.equal(notices.length, 2);
  assert.ok(notices[0].includes("closed for construction"));
  assert.ok(!notices.some((n) => n.includes("no current closures")));
});

test("species: only species the page names", () => {
  const vocabulary = [
    "Largemouth bass",
    "Yellow perch",
    "Species limited by alkaline conditions; confirm current tables",
  ];
  const found = speciesFrom("Anglers catch largemouth bass here.", vocabulary);
  assert.deepEqual(found, ["Largemouth bass"]);
  assert.deepEqual(speciesFrom("A page about trails.", vocabulary), []);
});

test("tags follow the water class and the access that was published", () => {
  const access = [{ name: "x", type: "boat_launch_and_fishing_pier", officiallyPublished: true }];
  const tags = tagsFrom("reservoir", access, "part of a state park");
  assert.ok(tags.includes("reservoir"));
  assert.ok(tags.includes("boat_ramp"));
  assert.ok(tags.includes("pier"));
  assert.ok(tags.includes("state_park"));
});

test("html: scripts and styles never reach the text", () => {
  const text = stripHtml("<style>.a{}</style><script>var x=1</script><p>Open daily.</p>");
  assert.equal(text.includes("var x"), false);
  assert.ok(text.includes("Open daily."));
});

test("sentences: fragments and boilerplate lengths are excluded", () => {
  const out = sentences(
    "Hi. The north boat ramp is closed for construction until spring of next year.",
  );
  assert.equal(out.length, 1);
});

test("sitemaps: an index is told apart from a page list", () => {
  const index = "<sitemapindex><sitemap><loc>https://a.gov/s1.xml</loc></sitemap></sitemapindex>";
  assert.equal(isSitemapIndex(index), true);
  assert.deepEqual(sitemapLocs(index), ["https://a.gov/s1.xml"]);
  assert.equal(isSitemapIndex("<urlset><url><loc>https://a.gov/lake</loc></url></urlset>"), false);
});

test("a management unit is filed under the water, not the unit", () => {
  const page = "Banks Lake Wildlife Area Unit provides shore fishing access on Banks Lake.";
  assert.equal(
    chooseWaterbodyName("Banks Lake Wildlife Area Unit", "Banks Lake Wildlife Area Unit", page),
    "Banks Lake",
  );
});

test("a provisional slug name is corrected by the published one", () => {
  const page = "Lake Corpus Christi State Park sits on Lake Corpus Christi, open for fishing.";
  assert.equal(
    chooseWaterbodyName("Corpus Christi", "Lake Corpus Christi State Park", page),
    "Lake Corpus Christi",
  );
});

test("a banner on every page of a site is furniture, not a notice", () => {
  const banner = "Check our wildfire information page for fire restrictions before you visit.";
  const real = "The north boat ramp is closed for construction until spring.";
  const pages = Array.from({ length: 10 }, (_, i) => ({
    host: "agency.gov",
    notices: i === 0 ? [banner, real] : [banner],
  }));
  const isFurniture = boilerplateFilter(pages);
  assert.equal(isFurniture("agency.gov", banner), true);
  assert.equal(isFurniture("agency.gov", real), false);
});

test("boilerplate is not guessed at from a handful of pages", () => {
  const notice = "The ramp is closed.";
  const pages = [
    { host: "a.gov", notices: [notice] },
    { host: "a.gov", notices: [notice] },
  ];
  assert.equal(
    boilerplateFilter(pages)("a.gov", notice),
    false,
    "two pages is not evidence of a template",
  );
});

test("a committee name is not a notice, however many times it says advisory", () => {
  const text = [
    "Mount Saint Helens Wildlife Area Advisory Committee",
    "Camping and overnight parking is prohibited in this wildlife area unit.",
  ].join("\n");
  const notices = noticesFrom(text);
  assert.equal(notices.length, 1);
  assert.ok(notices[0].startsWith("Camping"));
});

test("a species that is also an ordinary word is not read out of a permit notice", () => {
  const vocabulary = ["Permit", "Steelhead"];
  const found = speciesFrom(
    "A permit is required to park here. Steelhead run in autumn.",
    vocabulary,
  );
  assert.deepEqual(found, ["Steelhead"]);
});

test("navigation is not read as this page's content", () => {
  const html = `<nav><a>Public fishing piers</a><a>Fishing regulations</a></nav>
    <main>${"Abernathy Creek offers bank fishing along the shoreline for steelhead and salmon. ".repeat(8)}</main>
    <footer>Privacy policy</footer>`;
  const body = mainText(html);
  assert.equal(body.includes("Public fishing piers"), false);
  assert.ok(body.includes("Abernathy Creek"));
  assert.equal(accessFrom(body, "Abernathy Creek")[0].type, "shore_access");
});

test("a federal host can never vouch for a jurisdiction", () => {
  assert.equal(isMultiStateHost("blm.gov"), true);
  assert.equal(isMultiStateHost("www.nps.gov"), true);
  assert.equal(isMultiStateHost("fs.usda.gov"), true);
  assert.equal(isMultiStateHost("or.blm.gov"), true, "a regional subdomain is still federal");
  assert.equal(isMultiStateHost("wdfw.wa.gov"), false);
  assert.equal(isMultiStateHost("cpw.state.co.us"), false);
});

test("a management unit is filed under the water it sits on", () => {
  const page = "Dowdy Lake SWA offers bank fishing on Dowdy Lake.";
  assert.equal(chooseWaterbodyName("Dowdy Lake Swa", "Dowdy Lake SWA", page), "Dowdy Lake");
  assert.equal(stripDesignation("Prewitt Reservoir SWA"), "Prewitt Reservoir");
  assert.equal(stripDesignation("Elk River Wildlife Management Area"), "Elk River");
});

test("a plan, a road and a mountain range are not waters", () => {
  for (const name of [
    "Lake Simcoe Protection Plan",
    "Colorado River Headwaters Byway",
    "Fish Creek Mountains Wilderness",
    "Croy Creek Trailhead",
    "PNERP Implementing Plan for Chalk River Laboratories",
  ]) {
    assert.equal(namesADocumentOrPlace(name), true, `${name} should be refused`);
    assert.equal(chooseWaterbodyName(name, name, `${name} has fishing access.`), null);
  }
  assert.equal(namesADocumentOrPlace("Sam Rayburn Reservoir"), false);
  assert.equal(namesADocumentOrPlace("Devils River"), false);
});

test("a headline is not a waterbody, however many water words it contains", () => {
  assert.equal(
    refuseAsWaterbodyName("Convention Center Expansion Ruled Legally Sound"),
    "reads_as_a_sentence",
  );
  assert.equal(refuseAsWaterbodyName("Save the Bay Center"), "document_road_or_building");
  assert.equal(refuseAsWaterbodyName("Fish Hatchery Creek Facility"), "document_road_or_building");
  for (const good of [
    "Grant Lake",
    "North Fork American River",
    "Lake Casa Blanca",
    "Sam Rayburn Reservoir",
    "Devils River",
  ]) {
    assert.equal(refuseAsWaterbodyName(good), null, `${good} should be allowed`);
  }
});
