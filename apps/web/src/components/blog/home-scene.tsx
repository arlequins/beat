"use client";

import { useEffect, useRef } from "react";

export function HomeScene({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = ref.current;
    if (!scene) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let pointerFrame = 0;
    let active: HTMLElement | null = null;
    const reset = () => {
      cancelAnimationFrame(pointerFrame);
      if (active) {
        for (const property of [
          "--tilt-x",
          "--tilt-y",
          "--light-x",
          "--light-y",
        ])
          active.style.removeProperty(property);
        active.removeAttribute("data-lit");
        active = null;
      }
    };
    const illuminate = (event: PointerEvent) => {
      if (media.matches || event.pointerType === "touch") return;
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              ".index-latest, .index-reading, .index-route",
            )
          : null;
      if (target !== active) reset();
      if (!target) return;
      active = target;
      const bounds = target.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(1, (event.clientX - bounds.left) / bounds.width),
      );
      const y = Math.max(
        0,
        Math.min(1, (event.clientY - bounds.top) / bounds.height),
      );
      cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        target.style.setProperty("--tilt-x", `${(0.5 - y) * 3}deg`);
        target.style.setProperty("--tilt-y", `${(x - 0.5) * 3}deg`);
        target.style.setProperty("--light-x", `${x * 100}%`);
        target.style.setProperty("--light-y", `${y * 100}%`);
        target.setAttribute("data-lit", "true");
      });
    };
    scene.addEventListener("pointermove", illuminate, { passive: true });
    scene.addEventListener("pointerleave", reset);
    media.addEventListener("change", reset);
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
      reset();
      scene.removeEventListener("pointermove", illuminate);
      scene.removeEventListener("pointerleave", reset);
      media.removeEventListener("change", reset);
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
