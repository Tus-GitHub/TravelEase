const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compareSnapshots,QUERIES}=require('../schema-snapshot');
const {compareHashes}=require('../check-dev');
const base=()=>({migrations:['001.sql'],...Object.fromEntries(Object.keys(QUERIES).map(k=>[k,[{key:'sample',definition:'original'}]]))});
test('identical complete snapshots match',()=>assert.deepEqual(compareSnapshots(base(),base()),[]));
for(const section of Object.keys(QUERIES))test(`${section}: definition changes under same name are caught`,()=>{
  const changed=base();changed[section][0].definition='altered';assert.deepEqual(compareSnapshots(base(),changed),[`${section}: changed sample`]);
});
test('missing, extra and incomplete objects fail closed',()=>{
  const changed=base();changed.indexes=[];changed.triggers.push({key:'extra',definition:'x'});delete changed.functions;
  assert.equal(compareSnapshots(base(),changed).length,3);
});
test('ledger difference never masks other drift',()=>{
  const changed=base();changed.migrations.push('002.sql');changed.constraints[0].definition='wrong';
  assert.equal(compareSnapshots(base(),changed).length,2);
});
test('restore can omit environment-specific grants explicitly',()=>{
  const changed=base();changed.grants=[];changed.schemaGrants=[];
  assert.deepEqual(compareSnapshots(base(),changed,{includeGrants:false}),[]);
  assert.equal(compareSnapshots(base(),changed).length,2);
});
test('changed/deleted/unbaselined applied SQL is rejected',()=>{
  assert.equal(compareHashes({'001.sql':'old','002.sql':'hash'},{'001.sql':'new','003.sql':'new'},['001.sql','002.sql','003.sql']).length,4);
});
test('only restore comparisons accept distributed unbounded varchar array casts',()=>{
  const source=base(),restored=base();
  source.constraints[0].definition={definition:"CHECK (status::text = ANY (ARRAY['Draft'::character varying, 'Confirmed'::character varying]::text[]))",validated:true};
  restored.constraints[0].definition={definition:"CHECK (status::text = ANY (ARRAY['Draft'::character varying::text, 'Confirmed'::character varying::text]))",validated:true};
  assert.equal(compareSnapshots(source,restored).length,1);
  assert.deepEqual(compareSnapshots(source,restored,{restoreCasts:true}),[]);
  restored.constraints[0].definition.definition=restored.constraints[0].definition.definition.replace('Confirmed','Cancelled');
  assert.equal(compareSnapshots(source,restored,{restoreCasts:true}).length,1);
});
test('restore normalization does not hide bounded varchar casts or validation changes',()=>{
  const source=base(),restored=base();
  source.constraints[0].definition={definition:"CHECK (x = ANY (ARRAY['a'::character varying(2)]::text[]))",validated:true};
  restored.constraints[0].definition={definition:"CHECK (x = ANY (ARRAY['a'::character varying(2)::text]))",validated:true};
  assert.equal(compareSnapshots(source,restored,{restoreCasts:true}).length,1);
  restored.constraints[0].definition={...source.constraints[0].definition,validated:false};
  assert.equal(compareSnapshots(source,restored,{restoreCasts:true}).length,1);
});
