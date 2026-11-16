import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { regionPhoto } from "../../src/lib/region-photo.ts";
import { toBuilderRegion, toCardPackage, type PublicPackage } from "../../src/lib/server/catalogue.ts";
import { blankPackageContent, validateRouteTree, availableRouteTree, selectPackageRoute } from "../../src/lib/package-content.ts";
import { emptyMeals } from "../../src/lib/trip-plan.ts";

test("six regional covers use real local places and never replace an admin cover", () => {
  const catalogue = JSON.parse(readFileSync(new URL("../data/india-tourist-expansion.json", import.meta.url), "utf8"));
  const cities = ["Agra", "Shillong", "Kolkata", "Khajuraho", "Mumbai", "Mysuru"];
  const covers = ["North", "North East", "East", "Central", "West", "South"].map((name, index) => {
    const city = catalogue.cities.find((row: { name: string }) => row.name === cities[index]);
    const spots = city.spots.map((spot: { name: string; imageUrl: string }, i: number) => ({ ...spot, id: i + 1, cityName: city.name, cityId: index + 1, latitude: null, longitude: null, description: null, tag: null }));
    const row = { id: index + 1, name, state: city.state, imageUrl: null, spots };
    const cover = toBuilderRegion(row).imageUrl;
    assert(spots.some((spot: { imageUrl: string }) => spot.imageUrl === cover));
    assert.equal(toBuilderRegion({ ...row, imageUrl: "/owner-region.jpg" }).imageUrl, "/owner-region.jpg");
    return cover;
  });
  assert.equal(new Set(covers).size, 6);
  assert.equal(regionPhoto({ name: "No photos", imageUrl: null, spots: [] }), "/images/destination-illustration.svg");
  assert.equal(regionPhoto({ name: "Custom", imageUrl: null, spots: [{ name: "Place", imageUrl: "/owner-spot.jpg" }] }), "/owner-spot.jpg");
});

test("public package cards retain the pruned guided plan and its original base price", () => {
  const nodes = [
    { spotId: 1, next: [2, 3], nights: 0, extraPricePerPerson: 0, description: "", meals: emptyMeals(), canFinish: false },
    { spotId: 2, next: [], nights: 1, extraPricePerPerson: 400, description: "", meals: emptyMeals(), canFinish: true },
    { spotId: 3, next: [], nights: 2, extraPricePerPerson: 900, description: "", meals: emptyMeals(), canFinish: true },
  ];
  const tree = availableRouteTree(validateRouteTree({ roots: [1], nodes }), new Set([1, 2]));
  const guidedPlan = { content: { ...blankPackageContent(), routeTree: tree }, basePricePerPerson: 1000, destinations: [{ id: 1, name: "Dehradun" }, { id: 2, name: "Mussoorie" }] };
  const row: PublicPackage = { id: 9, slug: "owned-test", name: "Owned test", regionId: 1, regionName: "North", vehicleTypeSlug: "test", vehicleTypeTitle: "Test", durationDays: 2, imageUrl: null, highlights: [], maxPersons: 6, pricePerPerson: 1400, tag: null, rating: null, reviewCount: 0, destinations: [], isGuided: true, isBookable: true, guidedPlan };
  const card = toCardPackage(row);
  assert.equal(card.guidedPlan, guidedPlan);
  assert.deepEqual(card.guidedPlan!.content.routeTree!.nodes[0].next, [2]);
  const names = new Map(guidedPlan.destinations.map(place => [place.id, place.name]));
  assert.equal(selectPackageRoute(tree, [1, 2], card.guidedPlan!.basePricePerPerson, names).pricePerPerson, 1400);
  assert.throws(() => selectPackageRoute(tree, [1, 3], 1000, names));
  assert.throws(() => selectPackageRoute(tree, [1], 1000, names));
});
