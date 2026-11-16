import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {runtimeDatabaseConfig} from '../../src/lib/server/db-config.ts';
import {register} from 'node:module';
import {defaultCmsChrome} from '../../src/lib/cms-chrome.ts';
// React18's standalone entry lacks the Next server renderer's request cache.
// Only memoization is replaced; all CMS logic and database queries run unchanged.
register('data:text/javascript,'+encodeURIComponent("export async function resolve(s,c,next){if(s==='react')return{url:'data:text/javascript,export const cache=fn=>fn;',shortCircuit:true};return next(s,c);}"),import.meta.url);
const {createCmsPage,changeCmsPage,getPublishedCmsPage,getCmsNavigation,listCmsRevisions}=await import('../../src/lib/server/cms.ts');
assert(process.argv.includes('--dev')&&!process.env.VERCEL);
const host=value=>new URL(value).hostname.replace('-pooler.','.');assert.notEqual(host(process.env.DATABASE_URL),host(process.env.DATABASE_URL_PRODUCTION));
const client=new pg.Client(runtimeDatabaseConfig(process.env.DATABASE_URL)),actor=randomUUID(),slug='owned-chrome-'+randomUUID();let began=false,counter=0;const originalPool=globalThis.__pgPool;
await client.connect();
try{
 await client.query('BEGIN');began=true;
 globalThis.__pgPool={query:(...args)=>client.query(...args),connect:async()=>{const point='owned_chrome_'+(++counter);return{query:async(sql,params)=>{const command=typeof sql==='string'?sql.trim().toUpperCase():'';if(command==='BEGIN')return client.query('SAVEPOINT '+point);if(command==='COMMIT')return client.query('RELEASE SAVEPOINT '+point);if(command==='ROLLBACK'){await client.query('ROLLBACK TO SAVEPOINT '+point);return client.query('RELEASE SAVEPOINT '+point);}return client.query(sql,params);},release(){}};}};
 await client.query("INSERT INTO users(user_id,name,email,phone,password_hash,email_verified_at,role_id) VALUES($1,'Owned CMS test',$2,'','unusable',now(),(SELECT role_id FROM roles WHERE name='admin'))",[actor,actor+'@example.invalid']);
 let page=await createCmsPage({slug,title:'Owned CMS',template:'about'},actor);assert.equal(page.draft.navigation.header,false);assert.equal(page.draft.navigation.footer,false);
 const chrome=defaultCmsChrome();chrome.header.brandName='Owned test brand';chrome.footer.description='Owned test footer';
 const draft={...page.draft,chrome};draft.sections.find(s=>s.type==='features').content.items[0].style='outlined';
 page=await changeCmsPage(page.id,{action:'save',title:page.title,draft,version:page.version},actor);assert.equal(page.draft.chrome.header.brandName,'Owned test brand');assert.equal(await getPublishedCmsPage(slug),null);assert(!(await getCmsNavigation()).some(n=>n.href==='/'+slug));
 page=await changeCmsPage(page.id,{action:'publish',version:page.version},actor);assert.equal((await getPublishedCmsPage(slug)).chrome.footer.description,'Owned test footer');assert.equal((await getPublishedCmsPage(slug)).sections.find(s=>s.type==='features').content.items[0].style,'outlined');const revision=(await listCmsRevisions(page.id))[0];assert(revision);
 const next=structuredClone(page.draft);next.chrome.header.brandName='Unpublished change';next.navigation.header=true;
 page=await changeCmsPage(page.id,{action:'save',title:page.title,draft:next,version:page.version},actor);assert.equal((await getPublishedCmsPage(slug)).chrome.header.brandName,'Owned test brand');assert.equal((await getCmsNavigation()).find(n=>n.href==='/'+slug).header,false);
 await assert.rejects(()=>changeCmsPage(page.id,{action:'save',title:page.title,draft:next,version:page.version-1},actor),/another editor/);
 page=await changeCmsPage(page.id,{action:'publish',version:page.version},actor);assert.equal((await getCmsNavigation()).find(n=>n.href==='/'+slug).header,true);
 page=await changeCmsPage(page.id,{action:'restore',revisionId:revision.id,version:page.version},actor);assert.equal(page.draft.chrome.header.brandName,'Owned test brand');assert.equal((await getPublishedCmsPage(slug)).chrome.header.brandName,'Unpublished change');
 console.log('PASS real CMS chrome/style save, private drafts, explicit publication/menu flags, revision restore and stale-version protection.');
}finally{
 if(originalPool===undefined)delete globalThis.__pgPool;else globalThis.__pgPool=originalPool;
 if(began)await client.query('ROLLBACK');
 assert.equal(Number((await client.query('SELECT count(*) AS n FROM cms_pages WHERE slug=$1',[slug])).rows[0].n),0);
 assert.equal(Number((await client.query('SELECT count(*) AS n FROM users WHERE user_id=$1',[actor])).rows[0].n),0);
 await client.end();console.log('PASS every owned CMS page/revision/user/activity row rolled back; real Homepage/menus untouched.');
}
