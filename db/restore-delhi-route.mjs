import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import pg from 'pg';
import {runtimeDatabaseConfig} from '../src/lib/server/db-config.ts';
import {validateRouteTree} from '../src/lib/package-content.ts';
const production=process.argv.includes('--production'),test=process.argv.includes('--test'),publish=process.argv.includes('--publish-suggestions'),apply=process.argv.includes('--apply');
assert(!process.env.VERCEL&&(production||test||process.argv.includes('--dev')));
const config=production?process.env.DATABASE_URL_PRODUCTION:test?process.env.DATABASE_URL_TEST:process.env.DATABASE_URL;
const plan=JSON.parse(readFileSync(new URL('./data/delhi-draft-route.json',import.meta.url),'utf8')),db=new pg.Client(runtimeDatabaseConfig(config));await db.connect();
try{await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtextextended('admin-catalogue-relations',0))");const old=(await db.query('SELECT * FROM packages WHERE slug=$1 FOR UPDATE',[plan.slug])).rows[0];assert(old,'Expected original Delhi package');
 if(process.env.ROUTE_RECOVERY_BACKUP)writeFileSync(process.env.ROUTE_RECOVERY_BACKUP,JSON.stringify(old,null,2),{flag:'wx'});
 const mapping=new Map();for(const place of plan.places){const rows=(await db.query('SELECT ts.tourist_spot_id FROM tourist_spots ts JOIN cities c USING(city_id) JOIN states s USING(state_id) WHERE NOT ts.is_deleted AND NOT c.is_deleted AND NOT s.is_deleted AND geography_name_key(ts.name)=geography_name_key($1) AND geography_name_key(c.name)=geography_name_key($2) AND geography_name_key(s.name)=geography_name_key($3)',[place.name,place.city,place.state])).rows;assert.equal(rows.length,1,'Missing/ambiguous original destination '+place.name);mapping.set(place.id,rows[0].tourist_spot_id);}
 const restored=validateRouteTree({roots:plan.roots.map(id=>mapping.get(id)),nodes:plan.connections.map(node=>({spotId:mapping.get(node.id),next:node.next.map(id=>mapping.get(id)),canFinish:node.canFinish,nights:0,extraPricePerPerson:0,description:'',meals:{breakfast:0,lunch:0,dinner:0}}))});
 let result;
 if(publish){const existing=(await db.query('SELECT route_template_id FROM route_templates WHERE slug=$1 AND NOT is_deleted FOR UPDATE',[plan.slug])).rows[0];if(existing){result={status:'already exists; owner edits preserved',routeId:existing.route_template_id};}
 else{const tree={roots:restored.roots,nodes:restored.nodes.map(({spotId,next})=>({spotId,next,canFinish:true}))};const row=(await db.query('INSERT INTO route_templates(region_id,name,slug,route_tree,is_active) VALUES($1,$2,$3,$4,true) RETURNING route_template_id',[old.region_id,old.name,plan.slug,JSON.stringify(tree)])).rows[0];
 await db.query('UPDATE packages SET is_active=false,is_deleted=true WHERE package_id=$1',[old.package_id]);await db.query("INSERT INTO activity_logs(action,entity_type,entity_id,details) VALUES('route.restore_publish','route_templates',$1,$2::jsonb)",[String(row.route_template_id),JSON.stringify({sourcePackageId:old.package_id,stops:32,connections:37,hotels:false,fixedPrice:false})]);result={status:'restored and published as suggestions only',routeId:row.route_template_id,oldPackageId:old.package_id,stops:32,connections:37};}}
 else if(old.trip_content?.routeTree?.nodes?.length){result={status:'existing route retained',stops:old.trip_content.routeTree.nodes.length};}
 else{await db.query("UPDATE packages SET trip_content=jsonb_set(COALESCE(trip_content,'{}'::jsonb),'{routeTree}',$2::jsonb) WHERE package_id=$1",[old.package_id,JSON.stringify(restored)]);await db.query("INSERT INTO activity_logs(action,entity_type,entity_id,details) VALUES('route.restore','packages',$1,'{\"stops\":32,\"connections\":37}')",[String(old.package_id)]);result={status:'legacy tree restored; commercial package remains inactive',stops:32,connections:37};}
 await db.query(apply?'COMMIT':'ROLLBACK');console.log(JSON.stringify({...result,committed:apply}));
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
