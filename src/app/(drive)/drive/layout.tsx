"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
export default function DriveLayout({children}:{children:React.ReactNode}) {
  const {user,isLoading,logout}=useAuth();const router=useRouter();
  useEffect(()=>{if(!isLoading&&!user) router.replace('/login?redirect=/drive');},[user,isLoading,router]);
  if(isLoading||!user) return <p className="p-6">Loading…</p>;
  if(user.role!=='driver') return <p className="p-6">Driver access required. <Link href="/">Home</Link></p>;
  return <main className="min-h-screen bg-canvas p-4 text-fg"><div className="mx-auto max-w-2xl">
    <header className="mb-6 flex items-center justify-between"><Link href="/drive" className="font-bold">Jagdamba · Driver trips</Link><button onClick={()=>void logout()}>Sign out</button></header>{children}
  </div></main>;
}
