"use client";

import { useActionState, useRef, useState } from "react";
import { signIn } from "@/actions/auth";
import Link from "next/link";
import type { ActionResult } from "@/types";

const initialState: ActionResult = {};

function PinInput({ name }: { name: string }) {
  const [pins, setPins] = useState(["", "", "", ""]);
  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const refs = [r0, r1, r2, r3];

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
    <>
      <input type="hidden" name={name} value={pins.join("")} />
      <div className="flex gap-3 justify-center" onPaste={handlePaste}>
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
            className="w-16 h-16 text-center text-3xl font-bold border border-zinc-200 rounded-2xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent focus:bg-white transition-all"
          />
        ))}
      </div>
    </>
  );
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-xs">

        {/* 브랜드 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-2xl mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Knowledge Link Hub</h1>
          <p className="mt-1.5 text-sm text-zinc-500">4자리 PIN으로 로그인하세요</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <form action={formAction} className="space-y-6">
            {state.error && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl text-center">
                {state.error}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-center text-xs font-medium text-zinc-500">PIN 입력</p>
              <PinInput name="pin" />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-zinc-500">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="font-medium text-zinc-900 hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
