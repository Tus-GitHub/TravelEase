import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {getPool} from './db';
import {createTicket} from './support-tickets';
import type {PublicUser} from './users';
import {isValidPhone,normalizePhone,isValidEmail} from '../validation';
import {TripError} from '../weekend-trips';
import {availableRouteTree} from '../package-content';
import {expandedSuggestionTree,validateSuggestionTree,suggestionPath,type RouteTemplate,type RoutePlace,type SuggestedTree} from '../route-templates';
type Db=Pool|PoolClient;
const fields='t.route_template_id,t.region_id,t.name,t.slug,t.route_tree,t.version,t.is_active';
async function places(db:Db,tree:SuggestedTree,active:boolean):Promise<RoutePlace[]>{
 const rows=await db.query(`SELECT ts.tourist_spot_id,ts.name,c.name AS city_name,COALESCE(ts.image_url,'') AS image_url FROM tourist_spots ts JOIN cities c USING(city_id) JOIN states s ON s.state_id=c.state_id JOIN regions r ON r.region_id=s.region_id WHERE ts.tourist_spot_id=ANY($1::int[]) AND NOT ts.is_deleted AND NOT c.is_deleted AND NOT s.is_deleted AND NOT r.is_deleted ${active?'AND ts.is_active AND c.is_active AND s.is_active AND r.is_active':''} ORDER BY ts.tourist_spot_id`,[tree.nodes.map(node=>node.spotId)]);
 return rows.rows.map(row=>({id:row.tourist_spot_id,name:row.name,cityName:row.city_name,imageUrl:row.image_url}));
}
export async function listRouteTemplates(publicOnly=false,db:Db=getPool()):Promise<RouteTemplate[]>{
 const rows=(await db.query(`SELECT ${fields} FROM route_templates t JOIN regions r USING(region_id) WHERE NOT t.is_deleted ${publicOnly?'AND t.is_active AND r.is_active AND NOT r.is_deleted':''} ORDER BY t.route_template_id DESC LIMIT 100`)).rows;
 const result:RouteTemplate[]=[],trees=rows.map(row=>validateSuggestionTree(row.route_tree,!publicOnly));
 const catalogue=await places(db,{roots:[],nodes:trees.flatMap(tree=>tree.nodes)},publicOnly),activeIds=new Set(catalogue.map(place=>place.id));
 for(let i=0;i<rows.length;i++){const row=rows[i];let tree=trees[i];if(publicOnly){const pruned=availableRouteTree(expandedSuggestionTree(tree),activeIds);if(!pruned.roots.length)continue;tree=validateSuggestionTree(pruned);}const ids=new Set(tree.nodes.map(node=>node.spotId));const destinations=catalogue.filter(place=>ids.has(place.id));result.push({id:row.route_template_id,regionId:row.region_id,name:row.name,slug:row.slug,tree,version:row.version,isActive:row.is_active,places:destinations});}
 return result;
}
export async function saveRouteTemplate(input:Record<string,unknown>,actor:string):Promise<RouteTemplate>{
 const id=input.id===undefined?null:Number(input.id),version=Number(input.version),regionId=Number(input.regionId),name=typeof input.name==='string'?input.name.trim():'';
 if(id!==null&&(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(version)||version<1))throw new TripError('Reload this route before saving.');
 if(name.length<2||name.length>160||!Number.isSafeInteger(regionId)||regionId<1||typeof input.isActive!=='boolean')throw new TripError('Enter a route name and choose its region.');
 const tree=validateSuggestionTree(input.tree,!input.isActive),db=await getPool().connect();let routeId=id;
 try{await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtextextended('admin-catalogue-relations',0))");
 if(!(await db.query('SELECT 1 FROM regions WHERE region_id=$1 AND NOT is_deleted'+(input.isActive?' AND is_active':'')+' FOR SHARE',[regionId])).rowCount)throw new TripError('Choose an available region.');
 const all=await places(db,tree,Boolean(input.isActive));if(all.length!==tree.nodes.length)throw new TripError('Some destinations are unavailable. Review them before publishing.');
 const wrong=(await db.query('SELECT 1 FROM tourist_spots ts JOIN cities c USING(city_id) WHERE ts.tourist_spot_id=ANY($1::int[]) AND c.region_id<>$2 LIMIT 1',[tree.nodes.map(n=>n.spotId),regionId])).rowCount;if(wrong)throw new TripError('Choose destinations within this route’s region.');
 if(id===null){routeId=(await db.query('INSERT INTO route_templates(region_id,name,slug,route_tree,is_active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING route_template_id',[regionId,name,'route-'+randomUUID(),JSON.stringify(tree),input.isActive,actor])).rows[0].route_template_id;}
 else{const result=await db.query('UPDATE route_templates SET region_id=$2,name=$3,route_tree=$4,is_active=$5,updated_by=$6,version=version+1 WHERE route_template_id=$1 AND version=$7 AND NOT is_deleted RETURNING route_template_id',[id,regionId,name,JSON.stringify(tree),input.isActive,actor,version]);if(!result.rowCount)throw new TripError('This route changed in another editor. Reload before saving.',409);}
 await db.query("INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details) VALUES($1,$2,'route_templates',$3,$4::jsonb)",[actor,input.isActive?'route.publish':'route.save',String(routeId),JSON.stringify({destinations:tree.nodes.length,isActive:input.isActive})]);await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 return (await listRouteTemplates()).find(route=>route.id===routeId)!;
}
export async function sendRouteEnquiry(user:PublicUser,input:Record<string,unknown>){
 const template=(await listRouteTemplates(true)).find(route=>route.id===Number(input.templateId));if(!template)throw new TripError('This route is no longer published. Choose another route.',404);
 const path=suggestionPath(template.tree,input.path),phone=typeof input.phone==='string'?normalizePhone(input.phone):'',email=typeof input.email==='string'?input.email.trim().toLowerCase():'',travellers=Number(input.travellers),date=typeof input.date==='string'?input.date:'',notes=typeof input.notes==='string'?input.notes.trim():'';
 if(!isValidPhone(phone)||phone.length>30)throw new TripError('Enter a valid phone number so we can discuss your trip.');
 if(!isValidEmail(email)||email.length>254)throw new TripError('Enter a valid contact email for your booking request.');
 const parsedDate=date?new Date(date+'T00:00:00Z'):null;
 if(!Number.isSafeInteger(travellers)||travellers<1||travellers>100||notes.length>1000||date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsedDate!.getTime())||parsedDate!.toISOString().slice(0,10)!==date))throw new TripError('Check your traveller count, date and notes.');
 const names=new Map(template.places.map(place=>[place.id,place.name]));let vehicle='Not selected';
 if(input.vehicleId!==undefined){const id=Number(input.vehicleId);if(!Number.isSafeInteger(id)||id<1||id>2147483647)throw new TripError('Choose an available vehicle.');const row=(await getPool().query('SELECT name FROM vehicles WHERE vehicle_id=$1 AND is_active AND NOT is_deleted',[id])).rows[0];if(!row)throw new TripError('Choose an available vehicle.');vehicle=row.name;}
 const lines=['CUSTOM TRIP BOOKING REQUEST — CALL TO DISCUSS','Request only. No booking, price, hotel or meal inclusion is confirmed.','Contact email: '+email,'Phone: '+phone,'Travellers: '+travellers,'Preferred start: '+(date||'Discuss on call'),'Vehicle: '+vehicle,'Route plan: '+template.name,'Stop IDs: '+path.map(n=>n.spotId).join(','),'Stops: '+path.map(node=>names.get(node.spotId)?.slice(0,60)).join(' → '),'Accommodation: customer arranges their own stays.',...(notes?['Customer notes: '+notes]:[])];
 if(lines.join('\n').length>4000)throw new TripError('Please shorten your notes before sending this route.');
 return createTicket(user,{subject:'Trip request: '+template.name.slice(0,140),category:'booking',message:lines.join('\n')});
}
