"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { changePin } from "@/actions/auth";
import { Check, ChevronDown, KeyRound } from "lucide-react";
import type { ActionResult } from "@/types";

const initialState: ActionResult = {};

interface PinRowProps {
  label: string;
  name: string;
  resetKey?: number;
}

function PinRow({ label, name, resetKey }: PinRowProps) {
  const [pins, setPins] = useState(["", "", "", ""]);
  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const refs = [r0, r1, r2, r3];

  useEffect(() => {
    if (resetKey === undefined || resetKey === 0) return;
    setPins(["", "", "", ""]);
  }, [resetKey]);

  const handleChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...pins];
    next[i] = val.slice(-1);
    setPins(next);
    if (val && i < 3) refs[i + 1].current?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pins[i] && i > 0) refs[i - 1].current?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs[i - 1].current?.focus();
    if (e.key === "ArrowRight" && i < 3) refs[i + 1].current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    const next = ["", "", "", ""];
    text.split("").forEach((c, idx) => { next[idx] = c; });
    setPins(next);
    refs[Math.min(text.length, 3)].current?.focus();
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-zinc-600">{label}</label>
      <input type="hidden" name={name} value={pins.join("")} />
      <div className="flex gap-2" onPaste={handlePaste}>
        {pins.map((p, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={p}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            autoComplete="off"
            className={`w-11 h-11 text-center text-xl font-bold rounded-xl transition-all duration-150 focus:outline-none focus:ring-0 ${
              p
                ? "border-2 border-zinc-900 bg-white text-zinc-900 shadow-sm"
                : "border-2 border-zinc-200 bg-zinc-50 text-zinc-400 focus:border-zinc-400 focus:bg-white"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function PinSettings() {
  const [state, formAction, isPending] = useActionState(changePin, initialState);
  const [open, setOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (state.error) setResetKey((k) => k + 1);
    if (!state.error && state !== initialState) {
      // 성공 시 잠시 후 닫기
      setTimeout(() => setOpen(false), 1500);
    }
  }, [state]);

  const isSuccess = !state.error && state !== initialState;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
      {/* 헤더 (토글) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-zinc-900">PIN 변경</p>
            <p className="text-xs text-zinc-400 mt-0.5">로그인에 사용하는 4자리 PIN을 변경합니다</p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* 폼 (접기/펼치기) */}
      {open && (
        <div className="border-t border-zinc-100 px-6 py-5">
          <form action={formAction} className="space-y-4">
            {state.error && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl">
                {state.error}
              </div>
            )}
            {isSuccess && (
              <div className="flex items-center gap-2 p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl">
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
                PIN이 변경되었습니다.
              </div>
            )}

            <PinRow label="현재 PIN" name="current_pin" resetKey={resetKey} />
            <PinRow label="새 PIN" name="new_pin" resetKey={resetKey} />

            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {isPending ? "변경 중..." : "PIN 변경"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
