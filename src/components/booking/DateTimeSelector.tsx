"use client";

import { useState } from "react";
import BrandedDialog from "@/components/common/BrandedDialog";
import Button from "@/components/common/Button";
import { bookingInstant, bookingTimeValue, validBookingTime, INDIA_OFFSET_MS } from "@/lib/booking-datetime";

const pad = (n: number) => String(n).padStart(2, "0");
const localDateTime=(date:Date)=>date.toISOString().slice(0,16);
const validDateTime=validBookingTime;
const control = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-fg";

export default function DateTimeSelector({ label, value, onChange, min }: { label: string; value: string; onChange: (next: string) => void; min?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [month, setMonth] = useState(new Date());
  function begin() {
    const initialValue=validDateTime(value)?value:bookingTimeValue(new Date(Math.max(Date.now()+60*60*1000,min&&validDateTime(min)?bookingInstant(min).getTime()+60*60*1000:0)));
    const initial=new Date(`${initialValue}Z`);
    setDraft(initialValue);setMonth(new Date(Date.UTC(initial.getUTCFullYear(),initial.getUTCMonth(),1)));setOpen(true);
  }
  const date = validDateTime(draft) ? new Date(`${draft}Z`) : new Date(Date.now()+INDIA_OFFSET_MS);
  const earliest = Math.max(Date.now(), min && validDateTime(min) ? bookingInstant(min).getTime() : 0);
  const today = new Date(earliest+INDIA_OFFSET_MS); today.setUTCHours(0,0,0,0);
  const start = new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1)).getUTCDay();
  const count = new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).getUTCDate();
  const apply = validDateTime(draft) && bookingInstant(draft).getTime() > earliest;
  function changeTime(part: "hour" | "minute" | "period", next: string) {
    const changed = new Date(date);
    if (part === "minute") changed.setUTCMinutes(Number(next));
    else if (part === "hour") changed.setUTCHours(Number(next)%12+(date.getUTCHours()>=12?12:0));
    else changed.setUTCHours(date.getUTCHours()%12+(next==="PM"?12:0));
    setDraft(localDateTime(changed));
  }
  return <div>
    <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
    <button type="button" aria-label={label} aria-haspopup="dialog" onClick={begin} className={`${control} text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}>
      {validDateTime(value) ? bookingInstant(value).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"})+" IST" : "Choose date & time (IST)"}
    </button>
    {open && <BrandedDialog title={label} onClose={()=>setOpen(false)} compact>
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-label="Previous month" className="h-11 w-11 rounded-lg border border-line" onClick={()=>setMonth(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()-1,1)))}>‹</button>
          <p aria-live="polite" className="font-semibold">{month.toLocaleDateString("en-IN",{timeZone:"UTC",month:"long",year:"numeric"})}</p>
          <button type="button" aria-label="Next month" className="h-11 w-11 rounded-lg border border-line" onClick={()=>setMonth(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1)))}>›</button>
        </div>
        <div role="group" aria-label="Calendar" className="grid grid-cols-7 gap-1 text-center">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(day=><span key={day} className="py-1 text-xs text-muted">{day}</span>)}
          {Array.from({length:start},(_,i)=><span key={`blank-${i}`} />)}
          {Array.from({length:count},(_,i)=>{
            const day = new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),i+1));
            const selected = day.toISOString().slice(0,10)===date.toISOString().slice(0,10);
            return <button key={i} type="button" disabled={day<today} aria-pressed={selected}
              aria-label={day.toLocaleDateString("en-IN",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric"})}
              onClick={()=>{day.setUTCHours(date.getUTCHours(),date.getUTCMinutes());setDraft(localDateTime(day));}}
              className={`min-h-10 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-25 ${selected?"bg-primary-700 text-white":"hover:bg-surface-hover"}`}>{i+1}</button>;
          })}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-muted">Hour<select aria-label="Hour" className={`mt-1 ${control}`} value={date.getUTCHours()%12||12} onChange={e=>changeTime("hour",e.target.value)}>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{pad(i+1)}</option>)}</select></label>
          <label className="text-xs text-muted">Minute<select aria-label="Minute" className={`mt-1 ${control}`} value={date.getUTCMinutes()} onChange={e=>changeTime("minute",e.target.value)}>{Array.from({length:60},(_,i)=><option key={i} value={i}>{pad(i)}</option>)}</select></label>
          <label className="text-xs text-muted">AM / PM<select aria-label="AM / PM" className={`mt-1 ${control}`} value={date.getUTCHours()>=12?"PM":"AM"} onChange={e=>changeTime("period",e.target.value)}><option>AM</option><option>PM</option></select></label>
        </div>
        {!apply && <p role="status" className="text-sm text-red-600">Choose a time after {new Date(earliest).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} IST.</p>}
        <Button type="button" variant="accent" fullWidth disabled={!apply} onClick={()=>{onChange(draft);setOpen(false);}}>Use this date & time</Button>
      </div>
    </BrandedDialog>}
  </div>;
}
