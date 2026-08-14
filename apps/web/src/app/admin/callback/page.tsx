"use client";

import { useEffect, useState } from "react";
import {
  adminHomeUri,
  completeBeatAdminGoogleLogin,
} from "~/lib/beat-admin-session";

export default function BeatAdminCallbackPage() {
  const [message, setMessage] = useState("Google 로그인 확인 중입니다.");

  useEffect(() => {
    let active = true;
    void completeBeatAdminGoogleLogin()
      .then(() => {
        window.location.replace(adminHomeUri());
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Google 로그인에 실패했습니다.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto grid min-h-[60vh] max-w-md place-content-center gap-4 px-5 text-center">
      <p className="font-serif text-2xl font-black">Beat 관리자</p>
      <p className="text-sm text-[var(--muted)]">{message}</p>
      <a
        className="text-sm font-bold text-[var(--accent)] underline underline-offset-4"
        href="../"
      >
        관리자 로그인으로 돌아가기
      </a>
    </main>
  );
}
