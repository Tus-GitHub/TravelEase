"use client";

import { forwardRef, useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react";
import BrandedDialog from "@/components/common/BrandedDialog";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import { bookingTimeValue } from "@/lib/booking-datetime";
import Select from "./Select";
import { useControlLabel } from "./control-label";

type Props = InputHTMLAttributes<HTMLInputElement>;
const pad = (n: number) => String(n).padStart(2,"0");
const months = Array.from({length:12},(_,i)=>new Date(Date.UTC(2000,i,1)).toLocaleDateString("en-IN",{month:"long",timeZone:"UTC"}));
const field = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-fg";
function valid(value: string, timeOnly: boolean) {
  return timeOnly ? /^\d{2}:\d{2}$/.test(value) && +value.slice(0,2)<24 && +value.slice(3)<60
    : /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value) && Number.isFinite(Date.parse(value+(value.includes("T")?":00Z":"T00:00:00Z"))) && new Date(value+(value.includes("T")?":00Z":"T00:00:00Z")).toISOString().slice(0,value.length)===value;
}

const DateControl = forwardRef<HTMLInputElement, Props>(function DateControl({
  type="date", value, defaultValue, onChange, className="", id:suppliedId, disabled, required, min, max,
  "aria-label": label, "aria-labelledby": labelledBy, "aria-describedby": describedBy, "aria-invalid": invalid, ...props
}, forwardedRef) {
  const generated=useId(), id=suppliedId||`date-${generated}`;
  const root=useRef<HTMLSpanElement>(null), trigger=useRef<HTMLButtonElement>(null), native=useRef<HTMLInputElement|null>(null);
  const caption=useControlLabel(root,id,label,labelledBy);
  const timeOnly=type==="time", hasTime=type!=="date";
  const [internal,setInternal]=useState(String(defaultValue??"")),[open,setOpen]=useState(false),[draft,setDraft]=useState("");
  const [month,setMonth]=useState({year:2026,month:0});
  const current=value===undefined?internal:String(value),minimum=min===undefined?"":String(min),maximum=max===undefined?"":String(max);
  const good=valid(current,timeOnly);
  const draftDate=timeOnly?new Date("2000-01-01T"+(valid(draft,true)?draft:"10:00")+":00Z"):new Date((valid(draft,false)?draft:bookingTimeValue(new Date()).slice(0,hasTime?16:10))+(hasTime?":00Z":"T00:00:00Z"));
  const time=draftDate.toISOString().slice(11,16);
  const bounds=(next:string)=>valid(next,timeOnly)&&(!minimum||next>=minimum)&&(!maximum||next<=maximum);
  useEffect(()=>{
    const form=native.current?.form;
    const reset=()=>{const next=String(value??defaultValue??"");if(value===undefined)setInternal(next);window.setTimeout(()=>{if(native.current)native.current.value=next;},0);setOpen(false);};
    form?.addEventListener("reset",reset);return()=>form?.removeEventListener("reset",reset);
  },[value,defaultValue]);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  function begin(){
    if(trigger.current?.matches(":disabled"))return;
    let next=good?current:bookingTimeValue(new Date()).slice(timeOnly?11:0,timeOnly?16:hasTime?16:10);
    if(minimum&&next<minimum)next=minimum;if(maximum&&next>maximum)next=maximum;
    setDraft(next);const initial=new Date(timeOnly?"2000-01-01T"+next+":00Z":next+(hasTime?":00Z":"T00:00:00Z"));
    setMonth({year:initial.getUTCFullYear(),month:initial.getUTCMonth()});setOpen(true);
  }
  function commit(next:string){
    if(!native.current||trigger.current?.matches(":disabled")){setOpen(false);return;}
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;
    setter?.call(native.current,next);native.current.dispatchEvent(new Event("input",{bubbles:true}));native.current.dispatchEvent(new Event("change",{bubbles:true}));
    setOpen(false);trigger.current?.focus();
  }
  function dayValue(day:number){return `${month.year}-${pad(month.month+1)}-${pad(day)}`+(hasTime?"T"+time:"");}
  function shift(delta:number){const next=new Date(Date.UTC(month.year,month.month+delta,1));setMonth({year:next.getUTCFullYear(),month:next.getUTCMonth()});}
  function changeTime(part:"hour"|"minute"|"period",value:string){
    const date=new Date(draftDate);
    if(part==="minute")date.setUTCMinutes(+value);
    else if(part==="hour")date.setUTCHours(+value%12+(date.getUTCHours()>=12?12:0));
    else date.setUTCHours(date.getUTCHours()%12+(value==="PM"?12:0));
    setDraft(date.toISOString().slice(timeOnly?11:0,timeOnly?16:16));
  }
  const first=new Date(Date.UTC(month.year,month.month,1)).getUTCDay(),count=new Date(Date.UTC(month.year,month.month+1,0)).getUTCDate();
  const earliestYear=minimum&&!timeOnly?+minimum.slice(0,4):Math.min(month.year,new Date().getFullYear())-100;
  const latestYear=maximum&&!timeOnly?+maximum.slice(0,4):Math.max(month.year,new Date().getFullYear())+100;
  const display=good?(timeOnly?new Date("2000-01-01T"+current+":00Z"):new Date(current+(hasTime?":00Z":"T00:00:00Z"))).toLocaleString("en-IN",{timeZone:"UTC",...(timeOnly?{}:{day:"2-digit",month:"short",year:"numeric"}),...(hasTime?{hour:"numeric",minute:"2-digit"}:{})}):timeOnly?"Choose time":hasTime?"Choose date & time":"Choose date";
  return <span ref={root} data-custom-control="date" className="relative block min-w-0">
    <button ref={trigger} id={id} type="button" role="combobox" aria-label={labelledBy?undefined:caption} aria-labelledby={labelledBy} aria-describedby={describedBy} aria-invalid={invalid} aria-required={required||undefined} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?`${id}-calendar`:undefined} disabled={disabled} title={props.title} onClick={begin} onKeyDown={event=>{if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();begin();}}} className={`control-trigger ${className}`}><span className="min-w-0 flex-1 truncate">{display}</span><Icon name="calendar" className="h-4 w-4 shrink-0 opacity-60"/></button>
    <input {...props} ref={element=>{native.current=element;if(typeof forwardedRef==="function")forwardedRef(element);else if(forwardedRef)forwardedRef.current=element;}} id={`${id}-native`} type={type} value={current} min={min} max={max} required={required} disabled={disabled} aria-hidden="true" tabIndex={-1} className="control-native" onInvalid={event=>{event.preventDefault();trigger.current?.focus();begin();}} onChange={event=>{if(value===undefined)setInternal(event.currentTarget.value);onChange?.(event);}}/>
    {open&&<BrandedDialog id={`${id}-calendar`} compact title={caption} description={hasTime?"Choose a date and time, then apply your selection.":"Choose a day for your plans."} onClose={()=>setOpen(false)}>
      <div className="space-y-5 p-4 sm:p-6">
        {!timeOnly&&<><div className="flex items-center gap-2"><button type="button" aria-label="Previous month" disabled={Boolean(minimum&&`${month.year}-${pad(month.month+1)}`<=minimum.slice(0,7))} onClick={()=>shift(-1)} className="control-calendar-nav">‹</button><div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_5.5rem] gap-2"><Select aria-label="Month" value={month.month} onChange={event=>setMonth({...month,month:+event.target.value})} className={field}>{months.map((name,i)=><option key={name} value={i}>{name}</option>)}</Select><Select aria-label="Year" value={month.year} onChange={event=>setMonth({...month,year:+event.target.value})} className={field}>{Array.from({length:latestYear-earliestYear+1},(_,i)=><option key={i} value={earliestYear+i}>{earliestYear+i}</option>)}</Select></div><button type="button" aria-label="Next month" disabled={Boolean(maximum&&`${month.year}-${pad(month.month+1)}`>=maximum.slice(0,7))} onClick={()=>shift(1)} className="control-calendar-nav">›</button></div>
        <div role="group" aria-label="Calendar" className="grid grid-cols-7 gap-1 text-center">{["Su","Mo","Tu","We","Th","Fr","Sa"].map(day=><span key={day} className="py-1 text-xs font-medium text-muted">{day}</span>)}{Array.from({length:first},(_,i)=><span key={`blank-${i}`}/>)}{Array.from({length:count},(_,i)=>{const next=dayValue(i+1),date=new Date(next.slice(0,10)+"T00:00:00Z"),selected=draft.slice(0,10)===next.slice(0,10);return <button type="button" key={i} aria-label={date.toLocaleDateString("en-IN",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric"})} aria-pressed={selected} disabled={Boolean((minimum&&next.slice(0,10)<minimum.slice(0,10))||(maximum&&next.slice(0,10)>maximum.slice(0,10)))} onClick={()=>setDraft(next)} className="control-calendar-day">{i+1}</button>;})}</div></>}
        {hasTime&&<div className="grid grid-cols-3 gap-2"><label className="text-xs font-medium text-muted">Hour<Select aria-label="Hour" value={draftDate.getUTCHours()%12||12} className={`mt-1 ${field}`} onChange={event=>changeTime("hour",event.target.value)}>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{pad(i+1)}</option>)}</Select></label><label className="text-xs font-medium text-muted">Minute<Select aria-label="Minute" value={draftDate.getUTCMinutes()} className={`mt-1 ${field}`} onChange={event=>changeTime("minute",event.target.value)}>{Array.from({length:60},(_,i)=><option key={i} value={i}>{pad(i)}</option>)}</Select></label><label className="text-xs font-medium text-muted">AM / PM<Select aria-label="AM / PM" value={draftDate.getUTCHours()>=12?"PM":"AM"} className={`mt-1 ${field}`} onChange={event=>changeTime("period",event.target.value)}><option>AM</option><option>PM</option></Select></label></div>}
        {!bounds(draft)&&<p role="status" className="text-sm text-red-600">Choose a value{minimum?` on or after ${minimum.replace("T"," ")}`:""}{maximum?` on or before ${maximum.replace("T"," ")}`:""}.</p>}
        <div className="flex gap-2">{!required&&<Button type="button" variant="ghost" onClick={()=>commit("")}>Clear</Button>}<Button type="button" variant="accent" fullWidth disabled={!bounds(draft)} onClick={()=>commit(draft)}>{timeOnly?"Use time":hasTime?"Use date & time":"Use date"}</Button></div>
      </div>
    </BrandedDialog>}
  </span>;
});

/** Dynamic CMS fields keep their original text/number behavior. */
const DateInput=forwardRef<HTMLInputElement,Props>(function DateInput(props,ref){
  return ["date","time","datetime-local"].includes(props.type??"date")?<DateControl {...props} ref={ref}/>:<input {...props} ref={ref}/>;
});
export default DateInput;
