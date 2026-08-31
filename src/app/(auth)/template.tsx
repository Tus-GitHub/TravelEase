/**
 * Sign In <-> Sign Up transition (§10). Next re-mounts this wrapper on every
 * navigation within the (auth) group, so the CSS `.auth-swap` (a quiet fade +
 * short lift) replays each time — the shell, visual and nav in the layout stay
 * put. On first load it doubles as a small entrance for the card content, in
 * step with <AuthIntro>. Routes, history and form-state behaviour are
 * untouched; this is a presentation wrapper only.
 */
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return <div className="auth-swap">{children}</div>;
}
