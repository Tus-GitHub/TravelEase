// Canonical public-schema definitions. No application rows or credentials.
const QUERIES = {
  tables: `SELECT c.relname AS key, json_build_object('kind',c.relkind,'rls',c.relrowsecurity,
    'forceRls',c.relforcerowsecurity,'replicaIdentity',c.relreplident) AS definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY 1`,
  columns: `SELECT c.relname||'.'||a.attname AS key,
    json_build_object('type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
      'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated,
      'collation',CASE WHEN a.attcollation=0 THEN NULL ELSE a.attcollation::regcollation::text END) AS definition
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m') AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1`,
  constraints: `SELECT c.relname||'.'||co.conname AS key,
    json_build_object('definition',pg_get_constraintdef(co.oid,true),'validated',co.convalidated) AS definition
    FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' ORDER BY 1`,
  indexes: `SELECT ci.relname AS key,json_build_object('definition',pg_get_indexdef(i.indexrelid),
    'valid',i.indisvalid,'ready',i.indisready) AS definition
    FROM pg_index i JOIN pg_class ci ON ci.oid=i.indexrelid JOIN pg_namespace n ON n.oid=ci.relnamespace
    WHERE n.nspname='public' ORDER BY 1`,
  triggers: `SELECT c.relname||'.'||t.tgname AS key,
    json_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY 1`,
  functions: `SELECT p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS key,
    pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind IN ('f','p') ORDER BY 1`,
  views: `SELECT c.relname AS key,pg_get_viewdef(c.oid,true) AS definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('v','m') ORDER BY 1`,
  policies: `SELECT tablename||'.'||policyname AS key,
    json_build_object('permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check) AS definition
    FROM pg_policies WHERE schemaname='public' ORDER BY 1`,
  sequences: `SELECT sequencename AS key,json_build_object('type',data_type::text,'start',start_value,
    'min',min_value,'max',max_value,'increment',increment_by,'cycle',cycle,'cache',cache_size) AS definition
    FROM pg_sequences WHERE schemaname='public' ORDER BY 1`,
  extensions: `SELECT extname AS key,extversion AS definition FROM pg_extension ORDER BY 1`,
  grants: `SELECT c.relname||':'||pg_get_userbyid(c.relowner) AS key,
    ARRAY(SELECT x::text FROM unnest(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) x ORDER BY x::text) AS definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S') ORDER BY 1`,
  schemaGrants: `SELECT nspname||':'||pg_get_userbyid(nspowner) AS key,
    ARRAY(SELECT x::text FROM unnest(coalesce(nspacl,acldefault('n',nspowner))) x ORDER BY x::text) AS definition
    FROM pg_namespace WHERE nspname='public' ORDER BY 1`,
};

async function schemaSnapshot(client) {
  // Caller owns the transaction; never opens or commits one here.
  await client.query("SET LOCAL search_path=pg_catalog");
  const ledger = await client.query("SELECT migration_id FROM public.schema_migrations ORDER BY migration_id");
  const result = { migrations: ledger.rows.map(r => r.migration_id) };
  for (const [section,sql] of Object.entries(QUERIES)) result[section]=(await client.query(sql)).rows;
  return result;
}

// pg_dump/reparse can distribute an unbounded varchar-array -> text-array cast
// onto each literal. Normalize only that exact, lossless form for restore tests.
// Routine drift checks deliberately keep exact text comparisons.
function restoreConstraintCast(sql) {
  return sql.replace(/ARRAY\[((?:'(?:[^']|'')*'::character varying)(?:,\s*'(?:[^']|'')*'::character varying)*)\]::text\[\]/g,
    (_match,body)=>'ARRAY['+body.replace(/('(?:[^']|'')*')::character varying/g,'$1::character varying::text')+']');
}
function compareSnapshots(expected, actual, {includeGrants=true,restoreCasts=false}={}) {
  const differences=[];
  if (JSON.stringify(expected.migrations)!==JSON.stringify(actual.migrations)) differences.push("migration ledger differs");
  for (const section of Object.keys(QUERIES)) {
    if (!includeGrants && ["grants","schemaGrants"].includes(section)) continue;
    if (!Array.isArray(expected[section]) || !Array.isArray(actual[section])) {
      differences.push(`${section}: missing snapshot section`); continue;
    }
    const definition = r => JSON.stringify(restoreCasts && section==='constraints' && typeof r.definition?.definition==='string'
      ? {...r.definition,definition:restoreConstraintCast(r.definition.definition)} : r.definition);
    const before=new Map(expected[section].map(r=>[r.key,definition(r)]));
    const after=new Map(actual[section].map(r=>[r.key,definition(r)]));
    for (const key of before.keys()) {
      if (!after.has(key)) differences.push(`${section}: missing ${key}`);
      else if(before.get(key)!==after.get(key)) differences.push(`${section}: changed ${key}`);
    }
    for(const key of after.keys()) if(!before.has(key)) differences.push(`${section}: unexpected ${key}`);
  }
  return differences;
}
module.exports={schemaSnapshot,compareSnapshots,QUERIES,restoreConstraintCast};
