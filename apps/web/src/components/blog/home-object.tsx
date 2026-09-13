"use client";

import { useRef, useState } from "react";
import type { Locale } from "~/lib/i18n";

type Point = { x: number; y: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function simplify(points: Point[], tolerance: number): Point[] {
  const a = points[0];
  const b = points.at(-1);
  if (!a || !b || points.length < 3) return points;
  let maximum = 0;
  let index = 0;
  points.forEach((p, i) => {
    const length = distance(a, b);
    const d = length
      ? Math.abs(
          (b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x,
        ) / length
      : distance(a, p);
    if (d > maximum) {
      maximum = d;
      index = i;
    }
  });
  return maximum > tolerance
    ? [
        ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplify(points.slice(index), tolerance),
      ]
    : [a, b];
}

export function isMenuShape(points: Point[]) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 8) return false;
  const width =
    Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
  const height =
    Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
  const size = Math.max(width, height);
  if (Math.min(width, height) < 35 || distance(first, last) > size * 0.25)
    return false;
  const vertices = simplify([...points, first], size * 0.09);
  const corners = vertices.length - 1;
  const perimeter = points
    .slice(1)
    .reduce((sum, p, i) => sum + distance(p, points[i] ?? p), 0);
  return (corners === 3 || corners === 4) && perimeter < size * 5;
}

export function HomeObject({ locale }: { locale: Locale }) {
  const points = useRef<Point[]>([]);
  const [trail, setTrail] = useState("");
  const hint =
    locale === "ko"
      ? "△ 또는 □를 그려 메뉴 열기"
      : locale === "ja"
        ? "△・□を描いてメニュー"
        : "Draw △ or □ for menu";
  return (
    <div className="home-object-wrap">
      <div
        className="home-object"
        aria-hidden="true"
        onPointerDown={(event) => {
          if (
            event.pointerType !== "touch" ||
            !event.isPrimary ||
            !window.matchMedia("(max-width: 767px)").matches
          )
            return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const rect = event.currentTarget.getBoundingClientRect();
          points.current = [
            { x: event.clientX - rect.left, y: event.clientY - rect.top },
          ];
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const p = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };
          if (distance(points.current.at(-1) ?? p, p) < 2) return;
          points.current.push(p);
          setTrail(points.current.map((p) => `${p.x},${p.y}`).join(" "));
        }}
        onPointerUp={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          if (isMenuShape(points.current))
            document.getElementById("site-menu")?.showPopover();
          event.currentTarget.releasePointerCapture(event.pointerId);
          points.current = [];
          setTrail("");
        }}
        onPointerCancel={() => {
          points.current = [];
          setTrail("");
        }}
      >
        <div className="object-folios">
          <i />
          <i />
          <i />
        </div>
        <svg className="object-trail" width="100%" height="100%">
          <title>Gesture</title>
          <polyline points={trail} />
        </svg>
      </div>
      <span className="object-hint">{hint}</span>
    </div>
  );
}
