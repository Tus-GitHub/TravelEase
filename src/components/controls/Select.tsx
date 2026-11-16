"use client";

import { Children, forwardRef, isValidElement, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from "react";
import Icon from "@/components/common/Icon";
import ControlPopover from "./ControlPopover";
import { useControlLabel } from "./control-label";

interface Option { value: string; label: string; disabled: boolean; group?: string }
const text = (node: ReactNode): string => Children.toArray(node).map(child => isValidElement<{children?: ReactNode}>(child) ? text(child.props.children) : String(child)).join("");
function readOptions(children: ReactNode, group?: string, disabled = false): Option[] {
  const options: Option[] = [];
  Children.forEach(children, child => {
    if (!isValidElement<{value?: string | number; label?: string; children?: ReactNode; disabled?: boolean; hidden?: boolean}>(child)) return;
    const props = child.props;
    if (child.type === "option") {
      if (!props.hidden) options.push({ value: String(props.value ?? text(props.children)), label: props.label ?? text(props.children), disabled: disabled || Boolean(props.disabled), group });
    } else options.push(...readOptions(props.children, child.type === "optgroup" ? props.label : group, disabled || Boolean(props.disabled)));
  });
  return options;
}

/** Native form values/events, with an accessible, searchable custom listbox. */
const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({
  children, value, defaultValue, className = "", onChange, id: suppliedId, disabled, required,
  "aria-label": label, "aria-labelledby": labelledBy, "aria-describedby": describedBy, "aria-invalid": invalid, ...props
}, forwardedRef) {
  const generated = useId(), id = suppliedId || `select-${generated}`, listId = `${id}-options`;
  const root = useRef<HTMLSpanElement>(null), trigger = useRef<HTMLButtonElement>(null), native = useRef<HTMLSelectElement|null>(null);
  const search = useRef<HTMLInputElement>(null), typeahead = useRef({value: "", at: 0});
  const options = useMemo(() => readOptions(children), [children]);
  const [internal, setInternal] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const current = value === undefined ? internal : String(value);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [active, setActive] = useState(0);
  const caption = useControlLabel(root, id, label, labelledBy);
  const filtered = options.filter(option => `${option.label} ${option.group ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const selected = options.find(option => option.value === current);
  const searchable = options.length > 8;
  useEffect(() => {
    const resetValue=String(value??defaultValue??options[0]?.value??"");
    if(native.current)for(const option of Array.from(native.current.options))option.defaultSelected=option.value===resetValue;
  },[value,defaultValue,options]);
  function scrollActive() {
    const option=document.getElementById(`${listId}-${active}`), list=option?.parentElement;
    if(!option||!list)return;
    const item=option.getBoundingClientRect(),viewport=list.getBoundingClientRect();
    if(item.top<viewport.top)list.scrollTop-=viewport.top-item.top;
    else if(item.bottom>viewport.bottom)list.scrollTop+=item.bottom-viewport.bottom;
  }
  useEffect(() => {
    const form = native.current?.form;
    const reset = () => {
      const next=String(value ?? defaultValue ?? options[0]?.value ?? "");
      if (value === undefined) setInternal(next);
      window.setTimeout(() => { if (native.current) native.current.value=next; },0);
      setOpen(false);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [value, defaultValue, options]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (open) scrollActive();
    // Only the menu scrolls: scrollIntoView would also move/close parent dialogs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, listId]);
  function begin(last = false) {
    if(trigger.current?.matches(":disabled"))return;
    setQuery("");
    const chosen = options.findIndex(option => option.value === current && !option.disabled);
    setActive(chosen >= 0 ? chosen : last ? options.findLastIndex(option => !option.disabled) : options.findIndex(option => !option.disabled));
    setOpen(true);
  }
  function choose(option: Option) {
    if (option.disabled || !native.current || trigger.current?.matches(":disabled")) { setOpen(false); return; }
    if (current !== option.value) {
      native.current.value = option.value;
      native.current.dispatchEvent(new Event("change", {bubbles:true}));
    }
    setOpen(false); trigger.current?.focus();
  }
  function keyDown(event: KeyboardEvent<HTMLElement>) {
    const fromSearch = event.currentTarget === search.current;
    if (event.key === "Tab") { setOpen(false); return; }
    if (["ArrowDown","ArrowUp","Home","End"].includes(event.key)) {
      if (fromSearch && ["Home","End"].includes(event.key)) return;
      event.preventDefault();
      if (!open) { begin(event.key === "End"); return; }
      const direction = event.key === "ArrowUp" || event.key === "End" ? -1 : 1;
      let next = event.key === "Home" ? -1 : event.key === "End" ? filtered.length : active;
      for (let i=0;i<filtered.length;i++) { next = (next + direction + filtered.length) % filtered.length; if (!filtered[next].disabled) { setActive(next); break; } }
    } else if (event.key === "Enter" || (!fromSearch && event.key === " ")) {
      event.preventDefault(); if (open) { if (filtered[active]) choose(filtered[active]); } else begin();
    } else if (!fromSearch && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now(); typeahead.current = {value:(now-typeahead.current.at<700?typeahead.current.value:"")+event.key.toLowerCase(),at:now};
      const next = options.findIndex(option => !option.disabled && option.label.toLowerCase().startsWith(typeahead.current.value));
      if (!open) begin(); if (next >= 0) setActive(next);
    }
  }
  return <span ref={root} data-custom-control="select" className="relative block min-w-0">
    <button ref={trigger} id={id} type="button" role="combobox" aria-label={labelledBy ? undefined : caption} aria-labelledby={labelledBy}
      aria-describedby={describedBy} aria-invalid={invalid} aria-required={required || undefined} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? listId : undefined} aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      disabled={disabled} title={props.title} className={`control-trigger ${className}`} onClick={() => open ? setOpen(false) : begin()} onKeyDown={keyDown}>
      <span className="min-w-0 flex-1 truncate">{selected?.label || (options.length ? "Choose an option" : "No options available")}</span>
      <Icon name="chevron-down" className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    <select {...props} ref={element => { native.current = element; if (typeof forwardedRef === "function") forwardedRef(element); else if (forwardedRef) forwardedRef.current = element; }}
      id={`${id}-native`} value={current} disabled={disabled} required={required} aria-hidden="true" tabIndex={-1} className="control-native"
      onInvalid={event => { event.preventDefault(); trigger.current?.focus(); begin(); }}
      onChange={event => { if (value === undefined) setInternal(event.currentTarget.value); onChange?.(event); }}>{children}</select>
    {open && <ControlPopover anchor={trigger} onClose={() => setOpen(false)} onReady={() => { scrollActive(); if(searchable)search.current?.focus({preventScroll:true}); }}>
      {searchable && <div className="control-search"><Icon name="search" className="h-4 w-4 shrink-0 text-muted" /><input ref={search} type="search" autoComplete="off" aria-label={`Search ${caption}`} aria-controls={listId} aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined} placeholder="Type to find…" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={keyDown} className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none" /></div>}
      <div id={listId} role="listbox" aria-label={caption} className="control-options">
        {filtered.map((option,index) => <div key={option.value + index} id={`${listId}-${index}`} role="option" aria-selected={option.value === current} aria-disabled={option.disabled || undefined}
          data-active={active === index || undefined} className="control-option" onPointerMove={() => { if (!option.disabled) setActive(index); }} onPointerDown={event => event.preventDefault()} onClick={() => choose(option)}>
          <span className="min-w-0 flex-1"><span className="block break-words">{option.label}</span>{option.group && <span className="mt-0.5 block text-xs text-muted">{option.group}</span>}</span>
          {option.value === current && <Icon name="check" className="h-4 w-4 shrink-0 text-primary-600 dark:text-accent-400" />}
        </div>)}
        {!filtered.length && <p role="status" className="px-4 py-6 text-center text-sm text-muted">No matching options</p>}
      </div>
    </ControlPopover>}
  </span>;
});
export default Select;
