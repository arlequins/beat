"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

export type BookReaderRenderState = {
  flowRef: RefObject<HTMLElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  page: number;
  pageCount: number;
  pageWidth: number;
  controlsVisible: boolean;
  setControlsVisible: (
    visible: boolean | ((current: boolean) => boolean),
  ) => void;
  turn: (delta: number) => void;
};

/** Shared paginated surface and input handling for public and private readers. */
export function BookReader({
  children,
  className = "",
  label,
  layoutKey,
  onBoundaryTurn,
  onProgressChange,
  positionKey,
  viewportStyle,
}: {
  children: (state: BookReaderRenderState) => ReactNode;
  className?: string;
  label: string;
  layoutKey: string;
  onBoundaryTurn?: (delta: number) => void;
  onProgressChange?: (progress: number) => void;
  positionKey?: string;
  viewportStyle?: CSSProperties;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const progressCallback = useRef(onProgressChange);
  const boundaryCallback = useRef(onBoundaryTurn);
  const lastTouch = useRef(0);
  const lastTap = useRef({ time: 0, x: 0, y: 0 });
  const touchStart = useRef({ x: 0, y: 0 });
  const pendingTurn = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNativeDoubleClick = useRef(false);
  const doubleClickGuardTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);

  progressCallback.current = onProgressChange;
  boundaryCallback.current = onBoundaryTurn;

  useLayoutEffect(() => {
    if (!positionKey) {
      progress.current = 0;
      return;
    }
    try {
      const stored = Number(
        localStorage.getItem(`beat-fiction-v1-book-position-${positionKey}`),
      );
      progress.current = Number.isFinite(stored)
        ? Math.max(0, Math.min(1, stored))
        : 0;
    } catch {
      progress.current = 0;
    }
  }, [positionKey]);

  useLayoutEffect(() => {
    void layoutKey;
    const el = viewport.current;
    const text = flow.current;
    if (!el || !text) return;
    let frame = 0;
    let restoreFrame = 0;
    let active = true;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = el.clientWidth;
        if (!width || !el.clientHeight) return;
        text.style.height = `${el.clientHeight}px`;
        text.style.width = `${width - 48}px`;
        text.style.columnWidth = `${width - 48}px`;
        const count = Math.max(1, Math.ceil((text.scrollWidth + 48) / width));
        const target = Math.min(
          count - 1,
          Math.round(progress.current * (count - 1)),
        );
        setPageWidth(width);
        setPageCount(count);
        setPage(target);
        cancelAnimationFrame(restoreFrame);
        restoreFrame = requestAnimationFrame(() => {
          el.scrollLeft = target * width;
        });
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const contentObserver = new MutationObserver(measure);
    contentObserver.observe(text, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener("pageshow", measure);
    window.visualViewport?.addEventListener("resize", measure);
    document.fonts.addEventListener("loadingdone", measure);
    measure();
    document.fonts.ready.then(() => {
      if (active && el.isConnected) measure();
    });
    return () => {
      active = false;
      observer.disconnect();
      contentObserver.disconnect();
      window.removeEventListener("pageshow", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      document.fonts.removeEventListener("loadingdone", measure);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(restoreFrame);
    };
  }, [layoutKey]);

  const turn = useCallback(
    (delta: number) => {
      const el = viewport.current;
      if (!el || !pageWidth) return;
      const target = Math.max(0, Math.min(pageCount - 1, page + delta));
      if (target === page) {
        boundaryCallback.current?.(delta);
        return;
      }
      el.scrollLeft = target * pageWidth;
      setPage(target);
      progress.current = pageCount > 1 ? target / (pageCount - 1) : 0;
      progressCallback.current?.(progress.current);
      if (positionKey) {
        try {
          localStorage.setItem(
            `beat-fiction-v1-book-position-${positionKey}`,
            String(progress.current),
          );
        } catch {
          // Reading remains available when browser storage is disabled.
        }
      }
    },
    [page, pageCount, pageWidth, positionKey],
  );

  useLayoutEffect(
    () => () => {
      if (pendingTurn.current) clearTimeout(pendingTurn.current);
      if (doubleClickGuardTimer.current)
        clearTimeout(doubleClickGuardTimer.current);
    },
    [],
  );

  const scheduleTurn = (delta: number, delay = 240) => {
    if (pendingTurn.current) clearTimeout(pendingTurn.current);
    pendingTurn.current = setTimeout(() => {
      pendingTurn.current = null;
      turn(delta);
    }, delay);
  };

  const renderState: BookReaderRenderState = {
    flowRef: flow,
    viewportRef: viewport,
    page,
    pageCount,
    pageWidth,
    controlsVisible,
    setControlsVisible,
    turn,
  };

  return (
    <div
      className={`book-viewport ${className}`.trim()}
      ref={viewport}
      role="region"
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: The region supports keyboard paging.
      tabIndex={0}
      style={viewportStyle}
      onClick={(event) => {
        if ((event.target as Element).closest("a, button, input, label"))
          return;
        if (
          lastTouch.current > 0 &&
          performance.now() - lastTouch.current < 900
        )
          return;
        if (event.detail > 1) {
          if (pendingTurn.current) clearTimeout(pendingTurn.current);
          pendingTurn.current = null;
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const delta =
          x < bounds.width * 0.2 ? -1 : x > bounds.width * 0.8 ? 1 : 0;
        if (delta) scheduleTurn(delta);
      }}
      onDoubleClick={(event) => {
        if ((event.target as Element).closest("a, button, input, label"))
          return;
        if (suppressNativeDoubleClick.current) {
          suppressNativeDoubleClick.current = false;
          if (doubleClickGuardTimer.current)
            clearTimeout(doubleClickGuardTimer.current);
          doubleClickGuardTimer.current = null;
          return;
        }
        if (pendingTurn.current) clearTimeout(pendingTurn.current);
        pendingTurn.current = null;
        setControlsVisible((visible) => !visible);
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "touch")
          touchStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        if (
          event.pointerType !== "touch" ||
          !event.isPrimary ||
          (event.target as Element).closest("a, button, input, label")
        )
          return;
        lastTouch.current = performance.now();
        const x = event.clientX;
        const y = event.clientY;
        if (
          Math.hypot(x - touchStart.current.x, y - touchStart.current.y) > 12
        ) {
          lastTap.current.time = 0;
          return;
        }
        const now = performance.now();
        const previous = lastTap.current;
        if (
          now - previous.time < 650 &&
          Math.hypot(x - previous.x, y - previous.y) < 30
        ) {
          event.preventDefault();
          if (pendingTurn.current) clearTimeout(pendingTurn.current);
          pendingTurn.current = null;
          setControlsVisible((visible) => !visible);
          suppressNativeDoubleClick.current = true;
          if (doubleClickGuardTimer.current)
            clearTimeout(doubleClickGuardTimer.current);
          doubleClickGuardTimer.current = setTimeout(() => {
            suppressNativeDoubleClick.current = false;
            doubleClickGuardTimer.current = null;
          }, 500);
          lastTap.current = { time: 0, x, y };
          return;
        }
        lastTap.current = { time: now, x, y };
        const bounds = viewport.current?.getBoundingClientRect();
        const delta = bounds
          ? x < bounds.left + bounds.width * 0.2
            ? -1
            : x > bounds.left + bounds.width * 0.8
              ? 1
              : 0
          : 0;
        if (delta) scheduleTurn(delta, 350);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter") {
          event.preventDefault();
          setControlsVisible((visible) => !visible);
        }
        if (event.key === "Escape") setControlsVisible(false);
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          turn(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
      onScroll={() => {
        const el = viewport.current;
        if (!el || !pageWidth) return;
        const current = Math.min(
          pageCount - 1,
          Math.round(el.scrollLeft / pageWidth),
        );
        setPage(current);
        progress.current = pageCount > 1 ? current / (pageCount - 1) : 0;
        progressCallback.current?.(progress.current);
        if (positionKey) {
          try {
            localStorage.setItem(
              `beat-fiction-v1-book-position-${positionKey}`,
              String(progress.current),
            );
          } catch {
            // Reading remains available when browser storage is disabled.
          }
        }
      }}
    >
      <div
        className="book-track"
        style={{ width: pageWidth ? `${pageCount * pageWidth}px` : "100%" }}
      >
        {children(renderState)}
        <div className="book-snaps" aria-hidden="true">
          {Array.from({ length: pageCount }, (_, index) => (
            <span
              key={`page-${index + 1}`}
              style={{ left: index * pageWidth, width: pageWidth }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
