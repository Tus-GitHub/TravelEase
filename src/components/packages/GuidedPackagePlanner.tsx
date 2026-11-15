"use client";
import { useMemo, useState } from "react";
import Button from "@/components/common/Button";
import PackagePlanView from "./PackagePlanView";
import { selectPackageRoute, type PackageContent } from "@/lib/package-content";
import { mealSummary } from "@/lib/trip-plan";
export default function GuidedPackagePlanner({slug,name,content,destinations,basePrice}:{slug:string;name:string;content:PackageContent;destinations:{id:number;name:string}[];basePrice:number}){
  const [path,setPath]=useState<number[]>([]);
  const names=useMemo(()=>new Map(destinations.map(destination=>[destination.id,destination.name])),[destinations]);
  const tree=content.routeTree;
  const byId=useMemo(()=>new Map(tree?.nodes.map(node=>[node.spotId,node])??[]),[tree]);
  if(!tree?.roots.length)return <div className="rounded-xl border border-line p-5 text-sm text-muted">There are no bookable routes for this package right now. Please contact the team.</div>;
  const last=path.length?byId.get(path[path.length-1]):undefined,choices=last?last.next:tree.roots;
  let selected:ReturnType<typeof selectPackageRoute>|null=null;
  try{if(path.length)selected=selectPackageRoute(tree,path,basePrice,names,false);}catch{/* refreshed catalogue invalidates old choices */}
  const canContinue=Boolean(selected&&last?.canFinish);
  const href=`/booking/new?${new URLSearchParams({package:slug,path:path.join(',')})}`;
  return <section id="build-trip" className="scroll-mt-24 space-y-5 rounded-2xl border border-line bg-surface p-4 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Build your trip</p><h2 className="mt-1 text-xl font-bold text-fg">{name}</h2><p className="mt-2 text-sm leading-relaxed text-muted">Choose from routes our team can arrange. Each stop updates the nights, included meals and per-person price automatically.</p></div>
    {path.length>0&&<ol aria-label="Selected destinations" className="flex flex-wrap items-center gap-2">{path.map((id,i)=><li key={id}><button type="button" onClick={()=>setPath(path.slice(0,i+1))} className="min-h-11 rounded-full border border-line px-3 py-2 text-sm font-medium text-fg">{i+1}. {names.get(id)}{i<path.length-1?" →":""}</button></li>)}</ol>}
    {choices.length>0&&<fieldset><legend className="mb-3 font-semibold text-fg">{last?`Where next after ${names.get(last.spotId)}?`:"Where would you like to start?"}</legend><div className="grid gap-3 sm:grid-cols-2">{choices.map(id=>{const node=byId.get(id)!;return <button key={id} type="button" onClick={()=>setPath([...path,id])} className="min-h-20 rounded-xl border border-line p-4 text-left transition-colors hover:border-primary-500 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"><span className="block font-semibold text-fg">{names.get(id)}</span><span className="mt-1 block text-sm text-muted">{node.nights?`${node.nights} ${node.nights===1?'night':'nights'}`:'Day visit'} · {node.extraPricePerPerson?`+₹${node.extraPricePerPerson.toLocaleString('en-IN')}/person`:'Included in the base price'}</span>{node.description&&<span className="mt-2 line-clamp-2 block text-xs leading-relaxed text-muted">{node.description}</span>}</button>;})}</div></fieldset>}
    {selected&&<div aria-live="polite" className="rounded-xl bg-surface-muted p-4"><p className="font-semibold text-fg">{selected.days} {selected.days===1?'day':'days'} · {selected.nights} nights · ₹{selected.pricePerPerson.toLocaleString('en-IN')} / person</p>{mealSummary(selected.meals)&&<p className="mt-2 text-sm text-muted">Included: {mealSummary(selected.meals)}</p>}<p className="mt-2 text-xs text-muted">The final checkout applies your traveller count and any configured tax or discount before you confirm.</p></div>}
    <div className="flex flex-wrap gap-3">{canContinue&&<Button href={href} variant="accent" size="lg">Continue with this route</Button>}{path.length>0&&<Button type="button" variant="outline" onClick={()=>setPath(path.slice(0,-1))}>Change previous stop</Button>}{path.length>1&&<Button type="button" variant="ghost" onClick={()=>setPath([])}>Start again</Button>}</div>
    {last&&!last.canFinish&&<p className="text-sm text-muted">Choose the next destination to complete this route.</p>}
    {selected&&<PackagePlanView content={content} selectedRoute={selected}/>}
  </section>;
}
