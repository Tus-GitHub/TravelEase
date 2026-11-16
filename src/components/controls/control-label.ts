"use client";

import { useEffect, useState, type RefObject } from "react";

/** Legacy forms wrap controls in labels; resolve just the caption, never option text. */
export function useControlLabel(root: RefObject<HTMLElement>, id: string, label?: string, labelledBy?: string) {
  const [caption, setCaption] = useState("");
  useEffect(() => {
    if (label) return;
    if (labelledBy) {
      setCaption(labelledBy.split(/\s+/).map(reference => document.getElementById(reference)?.textContent?.trim()).filter(Boolean).join(" "));
      return;
    }
    const element = root.current;
    const parent = element?.closest("label") ?? document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (!parent) return;
    const node = Array.from(parent.childNodes).find(child => child.textContent?.trim() && !child.contains(element));
    if (node) setCaption(node.textContent?.trim() ?? "");
  }, [root, id, label, labelledBy]);
  return label || caption || "Choose an option";
}
