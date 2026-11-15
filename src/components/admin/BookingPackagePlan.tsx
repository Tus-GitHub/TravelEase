"use client";
import { useEffect, useState } from "react";
import PackagePlanView from "@/components/packages/PackagePlanView";
import type { PackagePlanSnapshot } from "@/lib/package-content";
export default function BookingPackagePlan({id}:{id:string}){
  const [plan,setPlan]=useState<PackagePlanSnapshot|null>(null),[error,setError]=useState("");
  useEffect(()=>{const controller=new AbortController();setPlan(null);setError("");fetch(`/api/admin/bookings/${encodeURIComponent(id)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{if(!response.ok)throw Error("Could not load the saved package plan.");const data=await response.json();if(!controller.signal.aborted)setPlan(data.item.packagePlan??null);}).catch(error=>{if(!controller.signal.aborted)setError(error.message);});return()=>controller.abort();},[id]);
  if(error)return <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>;
  if(!plan)return null;
  return <details className="mt-4 rounded-xl border border-line p-4"><summary className="min-h-8 cursor-pointer text-sm font-semibold text-fg">Saved itinerary, hotels, meals and inclusions</summary><div className="mt-4"><PackagePlanView content={plan.content} selectedRoute={plan.selectedRoute}/></div></details>;
}
