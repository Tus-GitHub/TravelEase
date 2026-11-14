"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
interface InstallContext {
  available: boolean;
  installed: boolean;
  install(): Promise<"accepted" | "dismissed" | "unavailable">;
}
const Context = createContext<InstallContext>({ available: false, installed: false, install: async () => "unavailable" });
export const useAppInstall = () => useContext(Context);

/** Keep the browser's one-use prompt across navigation to the install guide. */
export function AppInstallProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(null); };
    update();
    display.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    // Cache only the small generic offline page and brand icons. Account,
    // booking, API and rendered page responses never enter the worker cache.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(error => console.warn("Offline page unavailable", error));
    }
    return () => {
      display.removeEventListener("change", update);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  const install = useCallback(async () => {
    if (!prompt) return "unavailable" as const;
    setPrompt(null);
    await prompt.prompt();
    return (await prompt.userChoice).outcome;
  }, [prompt]);
  return <Context.Provider value={{ available: prompt !== null, installed, install }}>{children}</Context.Provider>;
}
