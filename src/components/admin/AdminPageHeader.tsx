export default function AdminPageHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <header className="relative mb-7 overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-[#070b14] via-[#0d1526] to-[#070b14] p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65)] sm:p-8">
    <div className="luxury-hairline pointer-events-none absolute inset-x-10 top-0" aria-hidden />
    <div aria-hidden className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[32px] border-amber-400/[0.04]" />
    <p className="relative mb-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
      Jagdamba Travellers · Admin
    </p>
    <div className={`relative [&_h1]:font-display [&_h1]:text-white [&_p]:text-slate-300 [&_p]:leading-relaxed ${className.replace("mb-6", "")}`}>{children}</div>
  </header>;
}
