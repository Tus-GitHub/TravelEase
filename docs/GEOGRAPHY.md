# Geography masters

The verified India master-data import contains all28 States and8 Union Territories
under the six [Incredible India tourism regions](https://www.incredibleindia.gov.in/en):
North, North East, East, Central, West and South. These are travel groupings rather
than statutory Zonal Council membership; for example Uttar Pradesh stays in North
and Andaman and Nicobar Islands is in East, matching the tourism directory.

The data-only maintenance command is dry-run by default:

```powershell
node --env-file=.env.local --experimental-strip-types db/seed-india-geography.mjs --production
```

Add `--verify-rollback` to rehearse inserts and validation without committing, or
`--apply` to insert missing entries. It reuses existing IDs, rejects ambiguous
duplicates or conflicting parents, preserves existing active flags, and never
changes Cities, Spots, packages or bookings. Repeating the import adds nothing.
No schema or new provider/service is needed. Keep the development catalogue's
independent demo data separate; ambiguous legacy records need review rather than
automatic merging or reparenting.

In **Admin → Geography**, use the four tabs in this order:

1. **Regions:** create North once.
2. **States:** choose North, then add Uttar Pradesh, Uttarakhand or another state/union territory.
3. **Cities:** choose the State, then add the city. Its Region is derived automatically.
4. **Tourist Spots:** choose the City, then add its destinations and map pins.

State, city and spot suggestions appear while typing. Picking a city suggestion
fills coordinates and its existing matching State. Spot suggestions match both
city and State; an ambiguous result requires the administrator to choose. Optional
map selection remains available. No parent record is silently created by a search.
Logical Region names such as North are entered directly, without spending map quota.

Names ignore case and repeated whitespace for duplicate checks. Region names are
unique globally; State names within their Region, City names within their State,
and Spot names within their City. The same city name in two States is valid. The
database enforces these rules for concurrent requests as well as ordinary forms.
Soft-deleted names can be reused; unrelated existing IDs and booking snapshots remain.

A Region with States, State with Cities, or City with Spots cannot be deleted
until its children are moved or removed. Moving a State updates its cities' derived
Region without replacing city/spot IDs. Packages and saved itineraries retain their
explicit Region assignment; review those assignments when reorganizing Regions.
Inactive States hide their destinations from the public builder and prevent new
package/custom-stop selections through them. Historical bookings keep their saved details.

## Upgrade and compatibility

Approved migration033 adds `states` and `cities.state_id`. Every old
`regions.state` value becomes a State under the same Region, and cities keep
their IDs. Existing unusual demo Region names are preserved for an administrator
to rename/reorganize; the migration does not invent a geographical taxonomy.

`regions.state` remains a deprecated compatibility field. Its input is absent
from the new Region editor. `cities.region_id` remains for existing references,
derived by a trigger from the State. An older writer can use a Region only when
it identifies exactly one State; an ambiguous multi-state Region fails safely.
The existing single-state fixture/rolling-client path is supported without
weakening the new State foreign key or making an arbitrary parent selection.

The homepage India explorer uses published Regions and actual destination IDs.
Selecting a Region zooms to its pinned destinations; choosing a Spot filters
packages by stored destination IDs. Create your package carries the selected
Region/Spot into the existing builder. Missing offers/pins are shown truthfully.
The SVG is stylised and its Region markers approximate; it makes no road-distance
or fare claims. Finite on-screen animation respects reduced motion; no provider
requests, paid map keys, WebGL or continuous animation loop is needed.

The CMS Destinations section controls the explorer's visibility, text and order.
The explicit restoration places it after Vehicles and preserves the package-first
hero and other saved CMS content. Later CMS edits remain authoritative.
