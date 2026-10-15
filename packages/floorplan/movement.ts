import type { Point } from "./model";

export type MoveAxis = "free" | "x" | "y";

// Snap displacement rather than absolute coordinates to preserve measured offsets.
export function furniturePosition(
  origin: Point,
  delta: Point,
  step: number,
  axis: MoveAxis,
): Point {
  if (
    ![origin.x, origin.y, delta.x, delta.y, step].every(Number.isFinite) ||
    step < 0
  )
    return origin;
  const shift = (v: number) => (step > 0 ? Math.round(v / step) * step : v);
  const x = origin.x + (axis === "y" ? 0 : shift(delta.x));
  const y = origin.y + (axis === "x" ? 0 : shift(delta.y));
  if (Math.abs(x) > 50000 || Math.abs(y) > 50000) return origin;
  return { x: Number(x.toFixed(6)), y: Number(y.toFixed(6)) };
}
