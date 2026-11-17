import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import pg from 'pg';
import {runtimeDatabaseConfig} from '../../src/lib/server/db-config.ts';
assert(process.argv.includes('--test')&&process.env.ROUTE_BROWSER_FIXTURES);
const url=process.env.DATABASE_URL_TEST;assert(new URL(url).hostname.replace('-pooler.','.')!==new URL(process.env.DATABASE_URL_PRODUCTION).hostname.replace('-pooler.','.'));
const db=new pg.Client(runtimeDatabaseConfig(url));await db.connect();try{await db.query('BEGIN');const users={};for(const role of ['admin','customer']){const id=randomUUID(),token=randomUUID();await db.query("INSERT INTO users(user_id,name,email,phone,password_hash,email_verified_at,role_id) VALUES($1,$2,$3,'','unusable',now(),(SELECT role_id FROM roles WHERE name=$4))",[id,'Owned route '+role,id+'@example.invalid',role]);await db.query("INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,now()+interval '2 hours')",[token,id]);users[role]={id,token};}await db.query('COMMIT');writeFileSync(process.env.ROUTE_BROWSER_FIXTURES,JSON.stringify(users),{flag:'wx'});console.log('Owned branch-only browser identities ready.');}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
