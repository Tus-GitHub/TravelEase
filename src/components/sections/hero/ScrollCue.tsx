export default function ScrollCue() {
  return (
    <div
      data-hero="scroll"
      className="absolute inset-x-0 bottom-7 flex flex-col items-center gap-2 text-white/50"
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.25em]">Scroll</span>
      <span className="relative flex h-9 w-5 items-start justify-center rounded-full border border-white/25 p-1">
        <span className="h-1.5 w-1 animate-[scrollcue_1.8s_ease-in-out_infinite] rounded-full bg-white/70" />
      </span>
    </div>
  );
}
