"use client";

import { useActionState, useRef, useState } from "react";
import { signUp } from "@/actions/auth";
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

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-8">
      <div className="w-full max-w-xs">

        {/* 브랜드 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-2xl mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Knowledge Link Hub</h1>
          <p className="mt-1.5 text-sm text-zinc-500">이름과 PIN으로 시작하세요</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <form action={formAction} className="space-y-5">
            {state.error && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl text-center">
                {state.error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-xs font-medium text-zinc-600">
                이름 <span className="text-zinc-400 font-normal">(표시 이름)</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                maxLength={50}
                placeholder="홍길동"
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
              />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-zinc-600">PIN <span className="text-zinc-400 font-normal">(4자리 숫자 · 로그인 시 사용)</span></p>
                <p className="mt-0.5 text-xs text-zinc-400">PIN은 아이디와 비밀번호를 겸합니다. 잊지 마세요.</p>
              </div>
              <PinInput name="pin" />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "가입 중..." : "회원가입"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-zinc-500">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="font-medium text-zinc-900 hover:underline">
              로그인
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-zinc-400">
          가입 시 서비스 이용약관 및 개인정보 처리방침에 동의합니다.
        </p>
      </div>
    </div>
  );
}
