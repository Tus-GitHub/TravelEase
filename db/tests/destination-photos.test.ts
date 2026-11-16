import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDestinationPhoto, destinationPhotoCredit, canFillDestinationPhoto } from '../../src/lib/destination-photo.ts';

const data=JSON.parse(readFileSync(new URL('../data/india-tourist-expansion.json',import.meta.url),'utf8'));
const credits=JSON.parse(readFileSync(new URL('../../src/data/destination-photo-credits.json',import.meta.url),'utf8'));
test('photo import preserves custom images and refuses unrecognised or traversal paths',()=>{
  const next='/images/destinations/jaipur-hawa-mahal-abc12345.webp';
  for(const old of [null,'','/images/destination-illustration.svg'])assert(canFillDestinationPhoto(old,next));
  for(const old of ['https://res.cloudinary.com/owner/image/upload/car.jpg','/my-photo.jpg',next])assert.equal(canFillDestinationPhoto(old,next),false);
  for(const url of ['//evil.example/a.webp','/images/destinations/../secret.webp','javascript:alert(1)','/images/destinations/a.webp?x=1']){assert.equal(isDestinationPhoto(url),false);assert.equal(destinationPhotoCredit(url),undefined);assert.equal(canFillDestinationPhoto(null,url),false);}
  assert.equal(destinationPhotoCredit(next),'/image-credits?photo=jaipur-hawa-mahal-abc12345.webp');
});
test('expanded catalogue retains starter identities and has source-backed photos for all180 places',()=>{
  assert.equal(data.cities.length,60);assert.equal(data.cities.flatMap((c:any)=>c.spots).length,180);assert.equal(credits.length,180);
  const initial=JSON.parse(readFileSync(new URL('../data/india-tourist-places.json',import.meta.url),'utf8'));
  const key=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
  assert.equal(new Set(data.cities.map((c:any)=>key(c.state+'/'+c.name))).size,60);
  for(const old of initial.cities){const city=data.cities.find((c:any)=>c.name===old.name&&c.state===old.state);assert(city);for(const spot of old.spots){const retained=city.spots.find((s:any)=>s.name===spot.name);assert(retained,spot.name);assert.equal(retained.latitude,spot.latitude);assert.equal(retained.longitude,spot.longitude);}}
  for(const city of data.cities){assert.equal(new Set(city.spots.map((s:any)=>key(s.name))).size,city.spots.length);for(const spot of city.spots){assert(isDestinationPhoto(spot.imageUrl));assert(spot.coordinateSource.startsWith('https://'));const km=Math.hypot((spot.latitude-city.latitude)*111,(spot.longitude-city.longitude)*111*Math.cos((spot.latitude+city.latitude)*Math.PI/360));assert(km<70,city.name+' / '+spot.name);assert(credits.some((p:any)=>p.imageUrl===spot.imageUrl&&p.place===spot.name&&p.city===city.name));}}
});
test('every shipped image has exact file provenance, a permitted license and a bounded size',()=>{
  const files=readdirSync(new URL('../../public/images/destinations/',import.meta.url));assert.equal(files.length,180);
  let total=0;
  for(const photo of credits){
    const bytes=readFileSync(new URL('../../public'+photo.imageUrl,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),photo.sha256);assert.equal(bytes.length,photo.bytes);assert(bytes.length<180000);total+=bytes.length;
    assert(/^https:\/\/commons\.wikimedia\.org\//.test(photo.sourceUrl));assert(photo.author.trim());assert(!/<[^>]+>/.test(photo.author));assert(/^(CC BY(?:-SA)? [\d.]+|CC0|Public domain)/.test(photo.license));
    if(photo.license.startsWith('CC BY'))assert(photo.licenseUrl.startsWith('https://creativecommons.org/licenses/'),photo.licenseUrl);
  }
  assert(total<16000000,'Static photo collection stays below16MB');
});
