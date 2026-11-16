import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { destinationCities, cityPackages, featuredCities } from '../../src/lib/destination-explorer.ts';
import type { Region, TravelPackage } from '../../src/types/index.ts';

const spot=(id:string,cityName:string,stateName:string)=>({id,name:'City Palace',cityName,stateName,tag:'Heritage',description:'',imageUrl:''});
const north:Region={id:'6',name:'North',state:'Rajasthan',imageUrl:'',spots:[spot('41','Jaipur','Rajasthan'),spot('42','Udaipur','Rajasthan')]};
const south:Region={id:'9',name:'South',state:'Karnataka',imageUrl:'',spots:[spot('43','Jaipur','Karnataka')]};
const pkg=(id:string,regionId:number,destinationIds:number[])=>({id,regionId,region:'North',destinationIds} as TravelPackage);

test('identically named spots and cities keep their real parent and booking IDs',()=>{
  const cities=destinationCities([north,south]);assert.equal(cities.length,3);assert.equal(new Set(cities.map(c=>c.key)).size,3);
  const jaipur=cities.find(c=>c.region.id==='6'&&c.name==='Jaipur')!;
  const packages=[pkg('right',6,[41]),pkg('other-city',6,[42]),pkg('other-region',9,[43]),pkg('name-only',6,[])];
  assert.deepEqual(cityPackages(packages,north,jaipur).map(p=>p.id),['right']);
  assert.deepEqual(cityPackages(packages,north,jaipur,north.spots[0]).map(p=>p.id),['right']);
  assert.deepEqual(cityPackages(packages,north).map(p=>p.id),['right','other-city','name-only']);
});
test('country overview includes each represented region and never invents city records',()=>{
  const cities=destinationCities([north,south]);const result=featuredCities(cities,2);
  assert.equal(result.length,2);assert.equal(new Set(result.map(c=>c.region.id)).size,2);
  assert(result.every(c=>cities.includes(c)));assert.deepEqual(featuredCities([]),[]);
});
test('curated import has unique parents/names and plausible nearby geographic anchors',()=>{
  const data=JSON.parse(readFileSync(new URL('../data/india-tourist-places.json',import.meta.url),'utf8'));
  const norm=(s:string)=>s.toLowerCase().trim().replace(/\s+/g,' ');
  assert.equal(data.cities.length,24);assert.equal(new Set(data.cities.map((c:any)=>norm(c.state+'/'+c.name))).size,24);
  let count=0;
  for(const city of data.cities){
    assert.equal(new Set(city.spots.map((s:any)=>norm(s.name))).size,city.spots.length);
    for(const place of [city,...city.spots]){assert(place.latitude>=6&&place.latitude<=38);assert(place.longitude>=67&&place.longitude<=99);assert(place.coordinateSource.startsWith('https://'));}
    for(const place of city.spots){
      const lat=(place.latitude+city.latitude)*Math.PI/360;
      const km=Math.hypot((place.latitude-city.latitude)*111,(place.longitude-city.longitude)*111*Math.cos(lat));
      assert(km<70,`${city.name} / ${place.name} is unexpectedly far from its city (${km.toFixed(0)} km)`);count++;
    }
  }
  assert.equal(count,48);
});
