"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { signIn } from "@/actions/auth";
import Link from "next/link";
import type { ActionResult } from "@/types";

const initialState: ActionResult = {};

interface PinInputProps {
  name: string;
  onComplete?: () => void;
  resetKey?: number;
}

function PinInput({ name, onComplete, resetKey }: PinInputProps) {
  const [pins, setPins] = useState(["", "", "", ""]);
  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const refs = [r0, r1, r2, r3];

  // 오류 시 PIN 리셋 + 첫 칸 포커스
  useEffect(() => {
    if (resetKey === undefined || resetKey === 0) return;
    setPins(["", "", "", ""]);
    setTimeout(() => refs[0].current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const handleChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...pins];
    next[i] = val.slice(-1);
    setPins(next);
    if (val && i < 3) {
      refs[i + 1].current?.focus();
    } else if (val && i === 3 && next.every((p) => p !== "")) {
      onComplete?.();
    }
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
    if (text.length === 4) onComplete?.();
  };

  return (
    <>
      <input type="hidden" name={name} value={pins.join("")} />
      <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
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
            className={`w-14 h-14 text-center text-2xl font-bold rounded-2xl transition-all duration-150 focus:outline-none focus:ring-0 ${
              p
                ? "border-2 border-zinc-900 bg-white text-zinc-900 shadow-sm"
                : "border-2 border-zinc-200 bg-zinc-50 text-zinc-400 focus:border-zinc-400 focus:bg-white"
            }`}
          />
        ))}
      </div>
    </>
  );
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);

  // 오류 발생 시 PIN 리셋
  useEffect(() => {
    if (state.error) setResetKey((k) => k + 1);
  }, [state.error]);

  function handlePinComplete() {
    formRef.current?.requestSubmit();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-xs">

        {/* 브랜드 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-2xl mb-4 shadow-sm">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Knowledge Link Hub
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">4자리 PIN으로 로그인하세요</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <form ref={formRef} action={formAction} className="space-y-6">
            {state.error && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl text-center">
                {state.error}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-center text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                PIN 입력
              </p>
              <PinInput
                name="pin"
                onComplete={handlePinComplete}
                resetKey={resetKey}
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  로그인 중...
                </>
              ) : "로그인"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-zinc-500">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="font-medium text-zinc-900 hover:underline">
              회원가입
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-400">
          PIN을 잊으셨나요?{" "}
          <Link href="/signup" className="text-zinc-500 hover:underline">
            새 계정 만들기
          </Link>
        </p>
      </div>
    </div>
  );
}
