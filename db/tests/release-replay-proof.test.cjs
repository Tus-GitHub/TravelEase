const {test}=require('node:test');
const assert=require('node:assert/strict');
const {schemaDigest,endpointDigest,verifyReplayProof}=require('../release-replay-proof');
const sample=()=>({migrations:['001.sql'],columns:[{key:'example.id',definition:{type:'uuid'}}],constraints:[{key:'example.pk',definition:{definition:'PRIMARY KEY (id)',validated:true}}],grants:[],schemaGrants:[]});
const options=()=>({production:sample(),development:{...sample(),migrations:['001.sql','002.sql']},prodUrl:'postgres://test@prod.example/app',devUrl:'postgres://test@dev.example/app',pending:['002.sql'],hashes:{'001.sql':'one','002.sql':'two'},now:Date.now()});
function evidence(o) {return {format:1,kind:'schema-only-migration-replay',verified:true,cleanupComplete:true,verifiedAt:new Date(o.now).toISOString(),productionEndpoint:endpointDigest(o.prodUrl),developmentEndpoint:endpointDigest(o.devUrl),productionSchema:schemaDigest(o.production),developmentSchema:schemaDigest(o.development),replayedSchema:schemaDigest(o.development),pending:o.pending,migrationHashes:o.hashes};}
test('fresh successful replay is bound to both schemas, endpoints and all SQL bytes',()=>{const o=options();assert(verifyReplayProof(evidence(o),o));});
test('missing, failed, uncleaned, stale, future or malformed evidence fails closed',()=>{
 const o=options(); assert.equal(verifyReplayProof(null,o),false);
 for(const patch of [{format:2},{kind:'other'},{verified:false},{cleanupComplete:false},{verifiedAt:'bad'},{verifiedAt:new Date(o.now-49*3600000).toISOString()},{verifiedAt:new Date(o.now+120000).toISOString()}]) assert.equal(verifyReplayProof({...evidence(o),...patch},o),false);
});
test('changed schema, source endpoint, replay result or pending SQL invalidates proof',()=>{
 const o=options(); const proof=evidence(o);
 for(const patch of [{productionSchema:'other'},{developmentSchema:'other'},{replayedSchema:'other'},{productionEndpoint:'other'},{developmentEndpoint:'other'},{pending:['003.sql']},{migrationHashes:{'001.sql':'one','002.sql':'changed'}}]) assert.equal(verifyReplayProof({...proof,...patch},o),false);
 const changed=structuredClone(o);changed.production.columns[0].definition.type='text';assert.equal(verifyReplayProof(proof,changed),false);
});
test('credentials and pooled host spelling do not change endpoint identity; database does',()=>{
 assert.equal(endpointDigest('postgres://a:secret@ep-test-pooler.example/app'),endpointDigest('postgres://b:another@ep-test.example/app'));
 assert.notEqual(endpointDigest('postgres://a@ep-test.example/app'),endpointDigest('postgres://a@ep-test.example/other'));
});
