"use client";

/**
 * Small, quiet password-strength read-out for the sign-up form. Purely
 * client-side guidance — the server still enforces the real minimum. Hidden
 * until the user starts typing so it never nags an empty field.
 */
function score(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const LEVELS = [
  { label: "Weak", fill: 1, color: "bg-red-400", text: "text-red-300" },
  { label: "Medium", fill: 2, color: "bg-accent-400", text: "text-accent-300" },
  { label: "Strong", fill: 3, color: "bg-emerald-400", text: "text-emerald-300" },
] as const;

export default function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;

  const s = score(value);
  const level = s >= 4 ? LEVELS[2] : s >= 3 ? LEVELS[1] : LEVELS[0];

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < level.fill ? level.color : "bg-white/12"
            }`}
          />
        ))}
        <span className={`ml-1 text-[11px] font-medium ${level.text}`}>{level.label}</span>
      </div>
    </div>
  );
}
