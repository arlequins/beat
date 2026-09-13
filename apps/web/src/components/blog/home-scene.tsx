"use client";

import { useEffect, useRef } from "react";

export function HomeScene({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = ref.current;
    if (!scene) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scene.style.setProperty(
          "--drift",
          media.matches ? "0px" : `${Math.min(window.scrollY * 0.06, 28)}px`,
        );
      });
    };
    window.addEventListener("scroll", update, { passive: true });
    media.addEventListener("change", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      media.removeEventListener("change", update);
    };
  }, []);
  return (
    <div className="home-scene" ref={ref}>
      <div className="scene-thread" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      {children}
    </div>
  );
}
