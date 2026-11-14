import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import type { Pool } from "pg";
import nodemailer from "nodemailer";
import { registerHooks } from "node:module";
import { hashPassword } from "../../src/lib/server/password.ts";
import { accountMailbox, resolveLoginIdentifier } from "../../src/lib/server/login-identifier.ts";
import { passwordLogin } from "../../src/lib/server/password-login.ts";
import { finishGoogleLogin } from "../../src/lib/server/google-login.ts";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const { POST: reset } = await import("../../src/app/api/auth/forgot-password/route.ts");
const { POST: signup } = await import("../../src/app/api/auth/signup/route.ts");

const id="00000000-0000-4000-8000-000000000001", label="admin@example.invalid", mailbox="owner+admin@example.invalid";
const password="Fixture password 123!", passwordHash=hashPassword(password);
let config:string|null, role:string, active:boolean, verified:boolean, lockedRole:string|null, returnedId:string, primaryEmail:string;
const sessions:unknown[][]=[], mails:Record<string,unknown>[]=[], tokens:unknown[][]=[];
const client={
  async query(sql:string,params:unknown[]=[]){
    if(["BEGIN","COMMIT","ROLLBACK"].includes(sql))return{rows:[],rowCount:0};
    if(sql.includes("FROM site_settings"))return{rows:config===null?[]:[{setting_value:config}],rowCount:config===null?0:1};
    if(sql.includes("SELECT u.email FROM users"))return{rows:active&&verified&&role==="admin"?[{email:primaryEmail}]:[],rowCount:active&&verified&&role==="admin"?1:0};
    if(sql.includes("r.name AS role"))return{rows:params[0]===primaryEmail&&active?[{user_id:returnedId,name:"Fixture admin",email:primaryEmail,phone:"",password_hash:passwordHash,role:sql.includes("FOR UPDATE")?(lockedRole??role):role,email_verified_at:verified?new Date():null,created_at:new Date()}]:[],rowCount:params[0]===primaryEmail&&active?1:0};
    if(sql.startsWith("SELECT user_id FROM users"))return{rows:active?[{user_id:id}]:[],rowCount:active?1:0};
    if(sql.startsWith("INSERT INTO sessions")){sessions.push(params);return{rows:[],rowCount:1};}
    if(sql.startsWith("SELECT email_verified_at FROM users"))return{rows:active?[{email_verified_at:verified?new Date():null}]:[],rowCount:active?1:0};
    if(sql.startsWith("SELECT 1 FROM password_reset_tokens"))return{rows:[],rowCount:0};
    if(sql.startsWith("INSERT INTO password_reset_tokens")){tokens.push(params);return{rows:[],rowCount:1};}
    throw Error("Unexpected fixture query; no real DB is available");
  },release(){},
};
const pool={...client,async connect(){return client;}};
(globalThis as unknown as {__pgPool:Pool}).__pgPool=pool as unknown as Pool;
const originalTransport=nodemailer.createTransport;
nodemailer.createTransport=(()=>({async sendMail(mail:Record<string,unknown>){mails.push(mail);return{accepted:[mail.to]};}})) as unknown as typeof nodemailer.createTransport;
Object.assign(process.env,{APP_ORIGIN:"http://localhost:3000",SMTP_HOST:"fixture.invalid",SMTP_USER:"fixture",SMTP_PASS:"fixture",EMAIL_FROM:"sender@example.invalid"});
beforeEach(()=>{config=JSON.stringify({identifier:label,userId:id});role="admin";active=true;verified=true;lockedRole=null;returnedId=id;primaryEmail=mailbox;sessions.length=0;mails.length=0;tokens.length=0;});
after(()=>{nodemailer.createTransport=originalTransport;});
const request=(route:string,body:object)=>new Request(`http://localhost:3000/api/auth/${route}`,{method:"POST",headers:{Origin:"http://localhost:3000",Host:"localhost:3000","Content-Type":"application/json"},body:JSON.stringify(body)});

test("alias resolves only to the configured verified admin's real mailbox",async()=>{
  assert.deepEqual(await resolveLoginIdentifier(client," ADMIN@EXAMPLE.INVALID "),{email:mailbox,aliasUserId:id});
  const result=await passwordLogin(label,password,true);assert(result.ok);assert.equal(result.user.id,id);assert.equal(result.user.email,mailbox);assert.equal(sessions.length,1);assert.equal(sessions[0][1],id);assert.equal(result.maxAge,30*86400);
});
test("alias does not grant access without the existing password",async()=>{assert.deepEqual(await passwordLogin(label,"wrong",false),{ok:false,reason:"invalid"});assert.equal(sessions.length,0);});
test("ordinary email login is unchanged without a configured alias",async()=>{config=null;const result=await passwordLogin(mailbox,password,false);assert(result.ok);assert.equal(result.maxAge,undefined);});
test("disabled and deleted-target semantics fail closed instead of falling through to label email",async()=>{active=false;assert.deepEqual(await resolveLoginIdentifier(client,label),{email:null,aliasUserId:id});assert.deepEqual(await passwordLogin(label,password,false),{ok:false,reason:"invalid"});assert.equal(sessions.length,0);});
test("demoted account cannot use admin alias",async()=>{role="customer";assert.deepEqual(await passwordLogin(label,password,false),{ok:false,reason:"invalid"});assert.equal(sessions.length,0);});
test("role is rechecked under the credential lock",async()=>{lockedRole="customer";assert.deepEqual(await passwordLogin(label,password,false),{ok:false,reason:"invalid"});assert.equal(sessions.length,0);});
test("alias cannot authenticate a different account after an email reassignment",async()=>{returnedId="00000000-0000-4000-8000-000000000002";assert.deepEqual(await passwordLogin(label,password,false),{ok:false,reason:"invalid"});assert.equal(sessions.length,0);});
test("normal account roles stay dynamic and do not depend on the admin login label",async()=>{role="customer";let result=await passwordLogin(mailbox,password,false);assert(result.ok);assert.equal(result.user.role,"customer");role="admin";result=await passwordLogin(mailbox,password,false);assert(result.ok);assert.equal(result.user.role,"admin");});
test("unverified account cannot use alias or receive an alias login session",async()=>{verified=false;assert.deepEqual(await passwordLogin(label,password,false),{ok:false,reason:"invalid"});assert.equal(sessions.length,0);});
test("malformed configuration cannot select a target or break normal email login",async()=>{for(const invalid of["{","null",JSON.stringify({identifier:label,userId:"not-an-id"}),JSON.stringify({identifier:"bad\r\nTo: victim@example.invalid",userId:id})]){config=invalid;assert.deepEqual(await resolveLoginIdentifier(client,mailbox),{email:mailbox,aliasUserId:null});}assert((await passwordLogin(mailbox,password,false)).ok);});
test("retired login email does not authenticate the renamed account",async()=>{assert.deepEqual(await passwordLogin("retired@example.invalid",password,false),{ok:false,reason:"invalid"});assert.equal(sessions.length,0);});
test("reset entered with login label emails the real mailbox, never the label",async()=>{const response=await reset(request("forgot-password",{email:label}));assert.equal(response.status,200);assert.equal(tokens.length,1);assert.equal(mails.length,1);assert.equal(mails[0].to,mailbox);assert.notEqual(mails[0].to,label);});
test("disabled admin alias reset remains neutral and sends nothing",async()=>{active=false;const response=await reset(request("forgot-password",{email:label}));assert.equal(response.status,200);assert.equal(mails.length,0);assert.equal(tokens.length,0);});
test("public signup cannot claim the operator's login-only alias",async()=>{const response=await signup(request("signup",{name:"External applicant",email:label,phone:"9999999999",password}));assert.equal(response.status,409);assert.equal(mails.length,0);assert.equal(sessions.length,0);});
test("account itself can show the app-only email while retaining its password and role",async()=>{primaryEmail=label;config=JSON.stringify({identifier:label,userId:id,recoveryEmail:mailbox});const result=await passwordLogin(label,password,false);assert(result.ok);assert.equal(result.user.email,label);assert.equal(result.user.role,"admin");assert.equal(result.user.id,id);});
test("managed account password reset sends only to its separate working recovery inbox",async()=>{primaryEmail=label;config=JSON.stringify({identifier:label,userId:id,recoveryEmail:mailbox});assert.equal((await reset(request("forgot-password",{email:label}))).status,200);assert.equal(mails.length,1);assert.equal(mails[0].to,mailbox);});
test("managed account without a valid recovery inbox cannot send reset links to the label",async()=>{primaryEmail=label;for(const recoveryEmail of[undefined,label,"bad\r\nTo: victim@example.invalid"]){config=JSON.stringify({identifier:label,userId:id,recoveryEmail});assert.equal((await reset(request("forgot-password",{email:label}))).status,200);assert.equal(mails.length,0);assert.equal(tokens.length,0);}});
test("contact resolution is bound to the account and never redirects other customers",async()=>{config=JSON.stringify({identifier:label,userId:id,recoveryEmail:mailbox});assert.equal(await accountMailbox(client,id,label),mailbox);assert.equal(await accountMailbox(client,"another-account",label),null);assert.equal(await accountMailbox(client,"another-account","customer@example.invalid"),"customer@example.invalid");});
test("a Google claim for the app-only address cannot link or take over the account",async()=>{primaryEmail=label;config=JSON.stringify({identifier:label,userId:id,recoveryEmail:mailbox});await assert.rejects(finishGoogleLogin("external-google-subject",label,"External identity"),/app-only identifier/);assert.equal(sessions.length,0);});
