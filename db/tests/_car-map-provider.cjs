// Test process only. Real public providers are never contacted by browser acceptance.
const assert=require('node:assert/strict');
if(process.env.CAR_BOOKING_MAP_STUB_URL){
  assert(process.env.BOOKING_SMOKE_SERVER==='dev-only'&&!process.env.VERCEL&&!process.env.DATABASE_URL_PRODUCTION);
  const stub=new URL(process.env.CAR_BOOKING_MAP_STUB_URL);assert.equal(stub.hostname,'127.0.0.1');
  const original=globalThis.fetch;
  globalThis.fetch=(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(['geocode-acceptance.invalid','car-acceptance.invalid'].includes(url.hostname)){
      return original(new URL(url.pathname+url.search,stub),init);
    }
    return original(input,init);
  };
}
