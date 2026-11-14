import assert from "node:assert/strict";
import { test } from "node:test";
import { validVehicleCrop, vehicleCropBox, vehicleCropUrl, vehicleImageSource } from "../../src/lib/vehicle-image.ts";
const original="https://res.cloudinary.com/fixture/image/upload/v123/jagdamba/development/00000000-0000-4000-8000-000000000001.webp";
test("crop URL pins the existing uploaded asset and recovers the full original",()=>{
  const crop={x:100,y:200,width:800,height:500};const url=vehicleCropUrl(original,crop)!;
  assert.equal(url,original.replace('/image/upload/','/image/upload/c_crop,x_100,y_200,w_800,h_500/f_auto,q_auto/'));
  assert.deepEqual(vehicleImageSource(url),{original,crop});assert.equal(vehicleCropUrl(url,null),original);
  assert.equal(vehicleCropUrl(url,{x:0,y:0,width:1600,height:1000}),vehicleCropUrl(original,{x:0,y:0,width:1600,height:1000}));
});
test("crop cannot switch host, resource kind, folder, asset, or add arbitrary transformations",()=>{
  for(const bad of[original+'?url=https://evil.invalid',original+'#fragment',original.replace('res.cloudinary.com','res.cloudinary.com.evil.invalid'),original.replace('/image/upload/','/image/fetch/'),original.replace('/jagdamba/','/another-folder/'),original.replace('/v123/','/e_blur/v123/'),original.replace('https://','http://')]){assert.equal(vehicleImageSource(bad),null);assert.equal(vehicleCropUrl(bad,null),null);}
});
test("server crop validation rejects malformed, oversized, off-frame and distorted selections",()=>{
  const valid={x:10,y:20,width:160,height:100};assert(validVehicleCrop(valid));
  for(const bad of[undefined,[],{}, {...valid,x:-1},{...valid,x:1900},{...valid,y:1950},{...valid,width:0},{...valid,width:160.5},{...valid,height:160},{...valid,width:'160'},{...valid,extra:'e_blur'}, {...valid,x:NaN},{...valid,y:Infinity}])assert.equal(validVehicleCrop(bad),false);
});
test("zoom, keyboard positions and pointer clamp keep a consistent eight-to-five frame",()=>{
  for(const [w,h]of[[1600,1200],[1200,1600],[2000,700],[700,2000],[1921,1081]])for(const zoom of[1,1.05,2,5])for(const x of[-10,0,50,100,120])for(const y of[0,50,100]){
    const c=vehicleCropBox(w,h,zoom,x,y);assert(validVehicleCrop(c));assert(c.x+c.width<=w&&c.y+c.height<=h);
    const reloaded=vehicleCropBox(w,h,Math.min(w,h*1.6)/c.width,w===c.width?50:c.x*100/(w-c.width),h===c.height?50:c.y*100/(h-c.height));assert.deepEqual(reloaded,c);
  }
});
