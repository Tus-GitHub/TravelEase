"use client";
import { useState } from 'react';
import AdminEditor from '@/components/admin/AdminEditor';
import AdminActionDialog from '@/components/admin/AdminActionDialog';
import Button from '@/components/common/Button';
export default function DriverLoginControl({id,email,reload}:{id:number;email:string|null;reload:()=>Promise<void>}) {
  const [open,setOpen]=useState(false), [address,setAddress]=useState(''), [password,setPassword]=useState('');
  const [revoking,setRevoking]=useState(false);
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  async function send(method:string) {
    setBusy(true);setError('');
    try {
      const r=await fetch(`/api/admin/drivers/${id}/login`,{method,headers:{'Content-Type':'application/json'},body:method==='POST'?JSON.stringify({email:address,password}):undefined});
      const d=await r.json(); if(!r.ok) throw new Error(d.error);
      setPassword('');setOpen(false);await reload();
      return {ok:true};
    } catch(e){const message=e instanceof Error?e.message:'Request failed.';setError(message);return {ok:false,error:message};} finally{setBusy(false);}
  }
  return <div className="space-y-2">
    {email?<><p>{email}</p><Button size="sm" variant="outline" loading={busy} onClick={()=>setRevoking(true)}>Revoke login</Button></>:
    <Button size="sm" variant="outline" onClick={()=>setOpen(!open)}>Create login</Button>}
    {revoking&&<AdminActionDialog title="Revoke driver login?" description={`${email} - this ends all sessions and removes login access.`} confirmLabel="Revoke login" danger onConfirm={()=>send("DELETE")} onClose={()=>setRevoking(false)}/>}
    {open&&<AdminEditor title="Create driver login" busy={busy} onClose={()=>{setOpen(false);setPassword('');setError('');}}><form className="space-y-2" onSubmit={e=>{e.preventDefault();void send('POST');}}>
      <label className="block">Email<input className="mt-2 block w-full rounded-xl border border-line bg-surface p-3" type="email" required value={address} onChange={e=>setAddress(e.target.value)}/></label>
      <label className="block">Initial password<input className="mt-2 block w-full rounded-xl border border-line bg-surface p-3" type="password" autoComplete="new-password" minLength={8} maxLength={200} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <p className="text-xs text-muted">Share credentials securely. The driver can change the password through Forgot password.</p>
      <Button size="sm" type="submit" loading={busy}>Create</Button>
      {error&&<p role="alert" className="text-red-600">{error}</p>}
    </form></AdminEditor>}
    {error&&!open&&!revoking&&<p role="alert" className="text-red-600">{error}</p>}
  </div>;
}
