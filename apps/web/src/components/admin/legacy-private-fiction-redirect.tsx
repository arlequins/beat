"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LegacyPrivateFictionRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/private/fictions/");
  }, [router]);

  return (
    <div className="grid min-h-screen place-content-center gap-4 px-6 text-center">
      <h1 className="font-serif text-2xl">
        비공개 소설 주소가 변경되었습니다.
      </h1>
      <Link className="underline underline-offset-4" href="/private/fictions/">
        새 비공개 소설 페이지로 이동
      </Link>
    </div>
  );
}
