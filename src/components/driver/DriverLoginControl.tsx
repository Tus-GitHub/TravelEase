"use client";
import { useState } from 'react';
import Button from '@/components/common/Button';
export default function DriverLoginControl({id,email,reload}:{id:number;email:string|null;reload:()=>Promise<void>}) {
  const [open,setOpen]=useState(false), [address,setAddress]=useState(''), [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  async function send(method:string) {
    setBusy(true);setError('');
    try {
      const r=await fetch(`/api/admin/drivers/${id}/login`,{method,headers:{'Content-Type':'application/json'},body:method==='POST'?JSON.stringify({email:address,password}):undefined});
      const d=await r.json(); if(!r.ok) throw new Error(d.error);
      setPassword('');setOpen(false);await reload();
    } catch(e){setError(e instanceof Error?e.message:'Request failed.');} finally{setBusy(false);}
  }
  return <div className="space-y-2">
    {email?<><p>{email}</p><Button size="sm" variant="outline" loading={busy} onClick={()=>{if(confirm('Revoke this driver login and all its sessions?')) void send('DELETE');}}>Revoke login</Button></>:
    <Button size="sm" variant="outline" onClick={()=>setOpen(!open)}>Create login</Button>}
    {open&&<form className="space-y-2" onSubmit={e=>{e.preventDefault();void send('POST');}}>
      <label className="block">Email<input className="block w-full border border-line bg-surface p-2" type="email" required value={address} onChange={e=>setAddress(e.target.value)}/></label>
      <label className="block">Initial password<input className="block w-full border border-line bg-surface p-2" type="password" autoComplete="new-password" minLength={8} maxLength={200} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <p className="text-xs text-muted">Share credentials securely. The driver can change the password through Forgot password.</p>
      <Button size="sm" type="submit" loading={busy}>Create</Button>
    </form>}
    {error&&<p role="alert" className="text-red-600">{error}</p>}
  </div>;
}
