"use client";
import {useEffect,useId,useRef,useState} from "react";
import {motion,useReducedMotion} from "framer-motion";
import Section from "@/components/common/Section";
import Button from "@/components/common/Button";
import Select from "@/components/controls/Select";
import PackageCard from "@/components/cards/PackageCard";
import {cmsHeading,type CmsSection} from "@/lib/cms";
import {mapNodes} from "@/data/destinations";
import {geographyKey} from "@/lib/geography";
import type {Region,TouristSpot,TravelPackage} from "@/types";

type Point={x:number;y:number};
const project=(lng:number,lat:number):Point=>({x:35+(lng-68)/30*370,y:25+(37.5-lat)/31*470});
// Decorative outline only; package availability and selectable places come from the catalogue.
const outline=[[74,35],[77,36],[79,34],[79,31],[81,30],[84,28],[88,27],[89,26],[92,27],[95,29],[97,28],[96,26],[94,24],[93,22],[92,23],[91,25],[89,26],[88,24],[89,22],[87,21],[85,19],[82,17],[80,14],[80,10],[78,8],[77,8],[75,13],[73,18],[72,21],[69,22],[68,24],[71,24],[70,26],[73,30],[74,33]].map(([lng,lat])=>project(lng,lat));
const land=outline.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ')+' Z';
const compass:Record<string,Point>={north:project(78,31),south:project(77,13),east:project(87,24),west:project(72,23),central:project(78,23),northeast:project(94,26)};
function spotPoint(spot:TouristSpot):Point|null{return typeof spot.latitude==='number'&&typeof spot.longitude==='number'&&Number.isFinite(spot.latitude)&&Number.isFinite(spot.longitude)&&spot.latitude>=6&&spot.latitude<=38&&spot.longitude>=67&&spot.longitude<=99?project(spot.longitude,spot.latitude):null;}
function regionPoint(region:Region):Point|null{
 const points=region.spots.map(spotPoint).filter((p):p is Point=>p!==null);
 if(points.length)return{x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length};
 const key=geographyKey(region.name).replace(/[-\s]/g,'').replace(/india$/,'');if(compass[key])return compass[key];
 const known=mapNodes.find(node=>geographyKey(node.name)===geographyKey(region.name)||geographyKey(node.state)===geographyKey(region.state));return known?project(known.lng,known.lat):null;
}

export default function DestinationMap({cms,regions=[],packages=[]}:{cms?:CmsSection;regions?:Region[];packages?:TravelPackage[]}={}){
 const id=useId(),root=useRef<HTMLDivElement>(null),reduced=useReducedMotion();
 const [ready,setReady]=useState(false),[visible,setVisible]=useState(false),[regionId,setRegionId]=useState(''),[spotId,setSpotId]=useState(''),[query,setQuery]=useState('');
 useEffect(()=>{setReady(true);const node=root.current;if(!node)return;const observer=new IntersectionObserver(entries=>setVisible(entries[0]?.isIntersecting??false),{rootMargin:'100px'});observer.observe(node);return()=>observer.disconnect();},[]);
 const region=regions.find(item=>item.id===regionId),spot=region?.spots.find(item=>item.id===spotId),animated=visible&&!reduced;
 const points=region?.spots.map(spotPoint).filter((point):point is Point=>point!==null)??[];
 const box=points.length?(()=>{const xs=points.map(p=>p.x),ys=points.map(p=>p.y),width=Math.max(6,(Math.max(...xs)-Math.min(...xs))*1.8,(Math.max(...ys)-Math.min(...ys))*1.8*440/520),height=width*520/440;return{x:(Math.min(...xs)+Math.max(...xs)-width)/2,y:(Math.min(...ys)+Math.max(...ys)-height)/2,width,height};})():{x:0,y:0,width:440,height:520};
 const scale=box.width/440;
 const shownRegions=regions.filter(item=>`${item.name} ${item.state} ${item.spots.map(s=>`${s.name} ${s.cityName??''}`).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
 const matching=packages.filter(pkg=>(!region||(pkg.regionId!==undefined?String(pkg.regionId)===region.id:pkg.region===region.name))&&(!spot||pkg.destinationIds?.includes(Number(spot.id))));
 const start=region?regionPoint(region):null,end=spot?spotPoint(spot):null,path=start&&end?`M${start.x} ${start.y} Q${(start.x+end.x)/2+24*scale} ${(start.y+end.y)/2-30*scale} ${end.x} ${end.y}`:'';
 function chooseRegion(value:string){setRegionId(value);setSpotId('');}
 function marker(point:Point,label:string,selected:boolean,onPick:()=>void){return <g role="button" tabIndex={ready?0:-1} aria-disabled={!ready} aria-label={label} aria-pressed={selected} onClick={()=>{if(ready)onPick();}} onKeyDown={event=>{if(ready&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onPick();}}} className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-white" transform={`translate(${point.x} ${point.y})`}><circle r={28*scale} fill="transparent"/><circle r={(selected?8:6)*scale} fill={selected?'#fbbf24':'#93c5fd'} stroke="#0f172a" strokeWidth={2*scale}/>{selected&&animated&&<circle r={10*scale} fill="none" stroke="#fcd34d" strokeWidth={scale}><animate attributeName="r" from={10*scale} to={22*scale} dur="1.4s" repeatCount="2"/><animate attributeName="opacity" from=".8" to="0" dur="1.4s" repeatCount="2"/></circle>}</g>;}
 return <Section bg="primary" eyebrow="Explore India" title="Find a place. Discover your trip." subtitle="Choose a region or destination to see its packages, or start creating your own itinerary." {...cmsHeading(cms)}>
  <div ref={root} className={`${['light','muted'].includes(cms?.appearance.background??'default')?'':'cms-dark'} grid items-start gap-7 lg:grid-cols-[.85fr_1.15fr]`} data-destination-explorer data-ready={ready}>
   <div className="relative mx-auto w-full max-w-md rounded-3xl border border-white/15 bg-primary-950 p-3">
    {region&&<button data-ui-action="" type="button" onClick={()=>chooseRegion('')} className="relative z-10 min-h-11 rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white">← All India</button>}
    <motion.svg initial={false} animate={{viewBox:`${box.x} ${box.y} ${box.width} ${box.height}`}} transition={{duration: animated ? 0.45 : 0}} role="group" aria-label="Interactive India destination map" className="aspect-[440/520] w-full"><defs><radialGradient id={`${id}-glow`}><stop stopColor="#60a5fa" stopOpacity=".28"/><stop offset="1" stopColor="#1e3a8a" stopOpacity="0"/></radialGradient></defs><rect width="440" height="520" fill={`url(#${id}-glow)`}/><path d={land} fill="#60a5fa" fillOpacity=".12" stroke="#7dd3fc" strokeOpacity=".6" strokeWidth={1.5*scale}/>
     {path&&<path key={`${regionId}-${spotId}`} d={path} fill="none" stroke="#fbbf24" strokeWidth={2*scale} pathLength="1" strokeDasharray="1" strokeDashoffset="0">{animated&&<animate attributeName="stroke-dashoffset" from="1" to="0" dur=".7s"/>}</path>}
     {!points.length&&regions.map(item=>{const point=regionPoint(item);return point?<g key={item.id}>{marker(point,`Explore region ${item.name}`,item.id===regionId,()=>chooseRegion(item.id))}<text x={point.x} y={point.y-16} textAnchor="middle" fill="#e0f2fe" fontSize="11" className="pointer-events-none">{item.name}</text></g>:null;})}
     {region?.spots.slice(0,30).map(item=>{const point=spotPoint(item);return point?<g key={item.id}>{marker(point,`Explore destination ${item.name}`,item.id===spotId,()=>setSpotId(item.id))}<text x={point.x} y={point.y-16*scale} textAnchor="middle" fill={item.id===spotId?'#fde68a':'#e0f2fe'} fontSize={11*scale} className="pointer-events-none">{item.name}</text></g>:null;})}
    </motion.svg><p className="px-2 pb-2 text-center text-xs leading-relaxed text-white/60">{region?region.name+' · ':''}Stylised map; region markers are approximate. Use the lists to explore every published destination.</p>
   </div>
   <div className="min-w-0 space-y-5">
    <label className="block text-sm font-semibold text-fg">Find a region or place<input disabled={!ready} type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Start typing…" className="mt-2 min-h-11 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base font-normal text-fg"/></label>
    <div className="flex flex-wrap gap-2" aria-label="Explore regions">{shownRegions.map(item=><button data-ui-action="" key={item.id} type="button" disabled={!ready} aria-pressed={regionId===item.id} onClick={()=>chooseRegion(item.id)} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none ${regionId===item.id?'border-accent-400 bg-accent-500 text-primary-950':'border-line bg-surface text-fg hover:border-accent-500'}`}>{item.name}</button>)}</div>
    {!shownRegions.length&&<p role="status" className="text-sm text-muted">No published regions match yet.</p>}
    {region&&<label className="block text-sm font-semibold text-fg">Destination in {region.name}<Select aria-label={`Destination in ${region.name}`} searchable value={spotId} onChange={event=>setSpotId(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-base font-normal text-fg"><option value="">All destinations</option>{region.spots.map(item=><option key={item.id} value={item.id}>{item.name}{item.stateName?` · ${item.stateName}`:''}</option>)}</Select></label>}
    <div aria-live="polite"><h3 className="text-xl font-semibold text-fg">{spot?`Packages for ${spot.name}`:region?`Packages in ${region.name}`:'Explore published packages'}</h3><p className="mt-1 text-sm text-muted">{matching.length} published {matching.length===1?'package':'packages'}</p></div>
    {!!matching.length&&<div className="grid gap-4 sm:grid-cols-2">{matching.slice(0,4).map(pkg=><PackageCard key={pkg.id} pkg={pkg}/>)}</div>}
    {!matching.length&&<p className="rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted">No ready-made package is published for this selection yet. You can shape your own route from available destinations.</p>}
    <div className="flex flex-wrap gap-3"><Button href={`/booking?mode=custom${region?`&region=${encodeURIComponent(region.id)}`:''}${spot?`&spot=${encodeURIComponent(spot.id)}`:''}`} variant="accent" iconRight="arrow-right">Create your package</Button><Button href="/packages" variant="outline">All packages</Button></div>
   </div>
  </div>
 </Section>;
}
