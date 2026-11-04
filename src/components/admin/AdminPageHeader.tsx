export default function AdminPageHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <header className="relative mb-7 overflow-hidden rounded-3xl border border-primary-800 bg-primary-950 p-6 shadow-sm sm:p-8">
    <div aria-hidden className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[32px] border-white/[0.03]" />
    <p className="relative mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-accent-400">Jagdamba Travellers · Admin</p>
    <div className={`relative [&_h1]:font-display [&_h1]:text-white [&_p]:text-primary-200 [&_p]:leading-relaxed ${className.replace("mb-6", "")}`}>{children}</div>
  </header>;
}
