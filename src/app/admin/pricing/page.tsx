"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import type { PricingValues } from "@/lib/server/admin/pricing";

type Rule=PricingValues&{id?:number;bookingType:string;vehicleId:number|null;vehicleTypeId:number|null;vehicleName?:string;vehicleTypeName?:string;isActive:boolean;priority:number};
type Data={rules:Rule[];vehicles:{id:number;name:string}[];vehicleTypes:{id:number;title:string}[];bookingTypes:{code:string;name:string}[]};
const empty:Rule={bookingType:"point_to_point",vehicleId:null,vehicleTypeId:null,isActive:true,priority:0,baseAmount:0,perKmRate:0,perHourRate:0,includedKm:0,extraKmRate:0,perDayRate:0,driverAllowancePerDay:0,nightCharge:0,flatRate:0,taxPercent:0,minKm:0,minHours:0};
const labels:Record<keyof PricingValues,string>={baseAmount:"Base fare (₹)",perKmRate:"Rate per km (₹)",perHourRate:"Rate per hour (₹)",includedKm:"Included kilometres",extraKmRate:"Extra km rate (₹)",perDayRate:"Rate per day (₹)",driverAllowancePerDay:"Driver allowance per day (₹)",nightCharge:"Night charge (₹)",flatRate:"Flat fare (₹; 0 uses per-km rate)",taxPercent:"Tax (%)",minKm:"Minimum billable km",minHours:"Minimum billable hours"};
const input="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-fg";
export default function PricingPage(){
  const {user,isLoading}=useAuth();const[data,setData]=useState<Data|null>(null),[form,setForm]=useState<Rule|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
  useEffect(()=>{if(user?.role!=="admin")return;let cancelled=false;fetch("/api/admin/pricing-rules",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("Could not load pricing.");const d=await r.json();if(!cancelled)setData(d);}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};},[user?.role,reload]);
  if(isLoading)return <p>Loading…</p>;
  if(user?.role!=="admin")return <p className="text-muted">Only an administrator can manage pricing.</p>;
  async function save(event:React.FormEvent){event.preventDefault();if(!form||busy)return;setBusy(true);setError("");setNotice("");try{const r=await fetch("/api/admin/pricing-rules",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const d=await r.json();if(!r.ok)throw new Error(d.error??"Could not save pricing.");setForm(null);setNotice("Pricing saved. New quotes use the updated rate; existing bookings keep their saved price.");setReload(n=>n+1);}catch(e){setError(e instanceof Error?e.message:"Could not save pricing.");}finally{setBusy(false);}}
  const shown:(keyof PricingValues)[]=form?.bookingType==="hourly"?["baseAmount","perHourRate","minHours","includedKm","extraKmRate","taxPercent"]:form?.bookingType==="package"?["perDayRate","driverAllowancePerDay","nightCharge","taxPercent"]:form?.bookingType==="outstation"?["baseAmount","perKmRate","minKm","driverAllowancePerDay","nightCharge","taxPercent"]:form?.bookingType==="airport_transfer"?["perKmRate","flatRate","taxPercent"]:["baseAmount","perKmRate","minKm","flatRate","taxPercent"];
  return <div className="space-y-5"><AdminPageHeader><h1 className="text-2xl font-bold text-fg">Car pricing</h1><p className="mt-1 text-sm text-muted">Individual car rate → vehicle-type rate → all-vehicles fallback. Existing bookings retain their fare.</p></AdminPageHeader>
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}{notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
    <Button variant="accent" onClick={()=>{setForm({...empty});setError("");}}>Add car rate</Button>
    {form&&<Card padded hover={false}><form onSubmit={save} className="space-y-4"><h2 className="text-lg font-semibold">{form.id?"Edit rate":"Configure rate"}</h2>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Car<select aria-label="Car" className={`mt-1 ${input}`} value={form.vehicleId??""} onChange={e=>setForm({...form,vehicleId:e.target.value?Number(e.target.value):null,vehicleTypeId:null})}><option value="">All vehicles / vehicle type</option>{data?.vehicles.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      <label className="text-sm">Trip type<select aria-label="Trip type" className={`mt-1 ${input}`} value={form.bookingType} onChange={e=>setForm({...form,bookingType:e.target.value})}>{data?.bookingTypes.map(t=><option key={t.code} value={t.code}>{t.name}</option>)}</select></label>
      {form.vehicleId===null&&<label className="text-sm">Vehicle type<select aria-label="Vehicle type" className={`mt-1 ${input}`} value={form.vehicleTypeId??""} onChange={e=>setForm({...form,vehicleTypeId:e.target.value?Number(e.target.value):null})}><option value="">All types (fallback)</option>{data?.vehicleTypes.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>}
      {shown.map(key=><label key={key} className="text-sm">{labels[key]}<input aria-label={labels[key]} required type="number" min={0} max={key==="taxPercent"?100:999999} step={key==="minHours"?1:0.01} value={form[key]} onChange={e=>setForm({...form,[key]:Number(e.target.value)})} className={`mt-1 ${input}`}/></label>)}
      <label className="text-sm">Priority<input aria-label="Priority" type="number" min={-10000} max={10000} step={1} value={form.priority} onChange={e=>setForm({...form,priority:Number(e.target.value)})} className={`mt-1 ${input}`}/></label></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/>Active</label>
      <p className="text-xs text-muted">For point-to-point and airport transfers, a nonzero flat fare overrides per-km billing. Use zero flat fare for distance-based prices. Outstation distance includes the return leg.</p>
      <div className="flex gap-2"><Button type="submit" variant="accent" disabled={busy}>{busy?"Saving…":"Save pricing"}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setForm(null)}>Cancel</Button></div>
    </form></Card>}
    {!data?<p className="text-sm text-muted">Loading pricing…</p>:<div className="grid gap-3 md:grid-cols-2">{data.rules.map(rule=><Card key={rule.id} padded hover={false}><h2 className="font-semibold text-fg">{rule.vehicleName??rule.vehicleTypeName??"All vehicles"}</h2><p className="mt-1 text-sm text-muted">{data.bookingTypes.find(t=>t.code===rule.bookingType)?.name} · {rule.isActive?"Active":"Inactive"}</p><p className="mt-2 text-sm text-fg">₹{rule.perKmRate}/km · ₹{rule.perHourRate}/hour · ₹{rule.perDayRate}/day{rule.flatRate?` · ₹${rule.flatRate} flat`:""}</p><Button className="mt-3" variant="outline" size="sm" onClick={()=>{setForm({...rule});setError("");}}>Edit {rule.vehicleName??rule.vehicleTypeName??"fallback"} {rule.bookingType.replaceAll("_"," ")}</Button></Card>)}</div>}
  </div>;
}
