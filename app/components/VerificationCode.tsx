"use client";
import { useRef, useState } from "react";

export default function VerificationCode() {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  function enter(index: number, text: string) {
    const value = text.replace(/\D/g, "").slice(0, 6 - index);
    setDigits(previous => { const next = [...previous]; next[index] = ""; [...value].forEach((digit, offset) => { next[index + offset] = digit; }); return next; });
    if (value) inputs.current[Math.min(index + value.length, 5)]?.focus();
  }
  return <fieldset className="verification-code"><legend>Six-digit code <span className="required-mark" aria-hidden="true">*</span></legend><div className="verification-code-boxes">{digits.map((digit, index) => <input key={index} ref={element => { inputs.current[index] = element; }} name="code" aria-label={`Code digit ${index + 1} of 6`} value={digit} required inputMode="numeric" pattern="[0-9]" maxLength={6} autoComplete={index === 0 ? "one-time-code" : "off"} onChange={event => enter(index, event.target.value)} onPaste={event => { const value = event.clipboardData.getData("text").replace(/\D/g, ""); if (value) { event.preventDefault(); enter(index, value); } }} onKeyDown={event => { if (event.key === "Backspace" && !digit && index > 0) { event.preventDefault(); setDigits(previous => previous.map((value, i) => i === index - 1 ? "" : value)); inputs.current[index - 1]?.focus(); } else if (event.key === "ArrowLeft" && index > 0) { event.preventDefault(); inputs.current[index - 1]?.focus(); } else if (event.key === "ArrowRight" && index < 5) { event.preventDefault(); inputs.current[index + 1]?.focus(); } }} onFocus={event => event.target.select()} />)}</div></fieldset>;
}
