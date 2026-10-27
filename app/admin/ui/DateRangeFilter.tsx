"use client";
import FormError from "../../components/FormError";

import { useId, useRef, useState, type FormEvent } from "react";
import Icon from "../../components/Icon";
export type DateRange = { from: string; to: string };
export const allDates: DateRange = { from: "", to: "" };
export function withinDates(date: string, range: DateRange) { const day = date.slice(0, 10); return (!range.from || day >= range.from) && (!range.to || day <= range.to); }
const reference = new Date().toISOString().slice(0, 10);
function iso(date: Date) { return date.toISOString().slice(0, 10); }
function offset(day: string, days: number) { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return iso(date); }
function makePresets(reference: string) { return [
  { label: "All Time", range: allDates },
  { label: "Today", range: { from: reference, to: reference } },
  { label: "Last 7 Days", range: { from: offset(reference, -6), to: reference } },
  { label: "Last 30 Days", range: { from: offset(reference, -29), to: reference } },
  { label: "This Month", range: { from: `${reference.slice(0, 7)}-01`, to: reference } },
]; }
const presets = makePresets(reference);
function rangeLabel(range: DateRange, choices = presets) { return choices.find((preset) => preset.range.from === range.from && preset.range.to === range.to)?.label ?? `${range.from || "Start"} – ${range.to || "Now"}`; }
export default function DateRangeFilter({ value, onChange, label }: { value: DateRange; onChange: (range: DateRange) => void; label: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const presets = makePresets(today);
  const id = useId(); const trigger = useRef<HTMLButtonElement>(null); const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false); const [draft, setDraft] = useState(value); const [error, setError] = useState("");
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`); const [choosingEnd, setChoosingEnd] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const date = new Date(`${month}T12:00:00Z`); const year = date.getUTCFullYear(); const monthIndex = date.getUTCMonth();
  const leading = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay(); const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  function close() { popup.current?.hidePopover(); }
  function moveMonth(delta: number) { setMonth(iso(new Date(Date.UTC(year, monthIndex + delta, 1)))); }
  function apply(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (draft.from && draft.to && draft.from > draft.to) { setError("From date must be on or before through date."); return; } if (draft.from && !draft.to) { setError("Select a through date to complete your range."); return; } setError(""); onChange(draft); close(); }
  function choose(day: string) { setError(""); if (!choosingEnd) { setDraft({ from: day, to: "" }); setChoosingEnd(true); } else { setDraft({ from: day < draft.from ? day : draft.from, to: day < draft.from ? draft.from : day }); setChoosingEnd(false); } }
  function preset(range: DateRange) { setDraft(range); setChoosingEnd(false); setError(""); setMonth(`${(range.from || today).slice(0, 7)}-01`); }
  return <div className="admin-date-picker"><button ref={trigger} type="button" className="admin-date-trigger" aria-label={`${label}: ${rangeLabel(value, presets)}`} aria-haspopup="dialog" aria-expanded={open} popoverTarget={id}><Icon name="calendar" /><span>Date:</span><strong>{rangeLabel(value, presets)}</strong><Icon name="chevron-down" className="admin-date-chevron" /></button>
    <div ref={popup} id={id} popover="auto" role="dialog" aria-label={label} className="admin-date-popover" style={position} onToggle={(event) => {
      const showing = event.newState === "open"; setOpen(showing);
      if (showing) { setDraft(value); setError(""); setChoosingEnd(false); setMonth(`${(value.from || today).slice(0, 7)}-01`); const rect = trigger.current?.getBoundingClientRect(); if (rect) { const width = Math.min(760, innerWidth - 32); const height = Math.min(610, innerHeight - 32); setPosition({ left: Math.max(16, Math.min(rect.right - width, innerWidth - width - 16)), top: Math.max(16, Math.min(rect.bottom + 8, innerHeight - height - 16)) }); } requestAnimationFrame(() => popup.current?.querySelector<HTMLButtonElement>(".admin-range-presets button")?.focus({ preventScroll: true })); }
    }}>
      <div className="admin-range-presets"><p>QUICK PRESETS</p>{presets.map((item) => <button type="button" key={item.label} className={draft.from === item.range.from && draft.to === item.range.to ? "selected" : ""} onClick={() => preset(item.range)}>{item.label}</button>)}<button type="button" className={rangeLabel(draft, presets).includes(" – ") ? "selected" : ""} onClick={() => popup.current?.querySelector<HTMLInputElement>('input[type="date"]')?.focus()}>Custom Range</button></div>
      <form className="admin-range-form" onSubmit={apply}>{error && <FormError className="admin-form-error" >{error}</FormError>}<div className="admin-range-inputs"><label>From Date<input type="date" aria-label={`${label} from`} value={draft.from} onChange={(event) => { setDraft({ ...draft, from: event.target.value }); setChoosingEnd(false); setError(""); if (event.target.value) setMonth(`${event.target.value.slice(0, 7)}-01`); }} /></label><label>Through Date<input type="date" aria-label={`${label} to`} value={draft.to} onChange={(event) => { setDraft({ ...draft, to: event.target.value }); setChoosingEnd(false); setError(""); }} /></label></div>
        <div className="admin-range-calendar"><div className="admin-calendar-heading"><button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}><Icon name="chevron-left" /></button><strong aria-live="polite">{date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</strong><button type="button" aria-label="Next month" onClick={() => moveMonth(1)}><Icon name="chevron-right" /></button></div><div className="admin-calendar-grid" role="group" aria-label="Choose range dates">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span className="admin-calendar-weekday" key={day}>{day}</span>)}{Array.from({ length: leading }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: count }, (_, i) => { const day = `${month.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`; const endpoint = day === draft.from || day === draft.to; const inside = !!draft.from && !!draft.to && day > draft.from && day < draft.to; return <button type="button" key={day} aria-label={day} aria-pressed={endpoint} className={`${endpoint ? "endpoint" : ""} ${inside ? "in-range" : ""} ${day === reference ? "reference-day" : ""}`} onClick={() => choose(day)}>{i + 1}</button>; })}</div></div>
        <p className="admin-range-help" role="status">{choosingEnd ? "Now select the through date." : "Select two dates to choose a range. Creation dates use UTC."}</p><div className="admin-range-footer"><button className="admin-range-reset" type="button" onClick={() => preset(allDates)}><Icon name="reset" />Reset</button><div><button className="admin-range-cancel" type="button" onClick={close}>Cancel</button><button className="admin-button" type="submit">Apply Range</button></div></div>
      </form>
    </div>
  </div>;
}
