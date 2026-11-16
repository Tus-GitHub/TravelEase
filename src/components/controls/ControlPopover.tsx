"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/** A real custom menu, above scrolling editors and modal dialogs. No third-party runtime. */
export default function ControlPopover({ anchor, children, onClose, onReady }: {
  anchor: RefObject<HTMLElement>; children: ReactNode; onClose: () => void; onReady?: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const ready = useRef(onReady);
  close.current = onClose;
  ready.current = onReady;
  const host = anchor.current?.closest("dialog") ?? (typeof document !== "undefined" ? document.body : null);
  useLayoutEffect(() => {
    const element = panel.current, trigger = anchor.current;
    if (!element || !trigger || !host) return;
    const modern = typeof element.showPopover === "function";
    let restoreFocus=false;
    const toggled=(event: Event)=>{
      if((event as ToggleEvent).newState==="closed") { close.current(); if(restoreFocus)trigger.focus(); }
    };
    element.addEventListener("toggle",toggled);
    if (modern) element.showPopover(); else element.style.display = "flex";
    function position() {
      if (!element || !trigger) return;
      const viewport = window.visualViewport;
      const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0, offsetLeft = viewport?.offsetLeft ?? 0;
      const rect = trigger.getBoundingClientRect();
      if(rect.bottom<offsetTop||rect.top>height+offsetTop) { close.current(); return; }
      const menuWidth = Math.min(Math.max(rect.width, 220), width - 24);
      const below = height + offsetTop - rect.bottom - 16, above = rect.top - offsetTop - 16;
      const useAbove = below < 200 && above > below;
      const maxHeight = Math.max(100, Math.min(376, useAbove ? above : below));
      element.style.width = `${menuWidth}px`;
      element.style.maxHeight = `${maxHeight}px`;
      element.style.left = `${Math.max(offsetLeft + 12, Math.min(rect.left, offsetLeft + width - menuWidth - 12))}px`;
      element.style.top = `${Math.max(offsetTop + 12, useAbove ? rect.top - Math.min(element.scrollHeight, maxHeight) - 8 : rect.bottom + 8)}px`;
    }
    position();
    ready.current?.();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target) && !trigger.contains(event.target)) close.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopImmediatePropagation();
      // WebKit can dispatch a dialog cancel after dismissing a nested popover.
      // Consume this Escape press for the menu, including its key-up default.
      const dialog=trigger.closest("dialog");
      const guard=(cancel:Event)=>{cancel.preventDefault();cancel.stopImmediatePropagation();};
      dialog?.addEventListener("cancel",guard,true);
      const release=()=>{dialog?.removeEventListener("cancel",guard,true);document.removeEventListener("keyup",keyUp,true);window.clearTimeout(timeout);};
      const keyUp=(key:KeyboardEvent)=>{if(key.key==="Escape"){key.preventDefault();key.stopImmediatePropagation();window.setTimeout(release,0);}};
      const timeout=window.setTimeout(release,2000);
      document.addEventListener("keyup",keyUp,true);
      restoreFocus=true; close.current(); trigger.focus();
    };
    const scroll = (event: Event) => { if (event.target instanceof Node && !element.contains(event.target)) position(); };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", position);
    window.visualViewport?.addEventListener("resize", position);
    const observer = new ResizeObserver(position); observer.observe(trigger);
    return () => {
      element.removeEventListener("toggle",toggled);
      if (modern && element.matches(":popover-open")) element.hidePopover();
      observer.disconnect();
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("resize", position);
    };
  }, [anchor, host]);
  if (!host) return null;
  return createPortal(<div ref={panel} {...{ popover: "auto" }} data-lenis-prevent="" className="control-popover">{children}</div>, host);
}
