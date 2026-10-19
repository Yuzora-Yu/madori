import type { Point } from "./model";

export type CanvasView = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type CanvasRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};
const center = (points: Point[]) =>
  points.length > 1
    ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
    : points[0];
const separation = (points: Point[]) =>
  points.length > 1
    ? Math.max(
        20,
        Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
      )
    : 1;

/** Pointer-only navigation: after a pinch, a remaining finger can pan but never edit. */
export class TouchNavigation {
  readonly points = new Map<number, Point>();
  navigating = false;
  moved = false;
  view: CanvasView | null = null;
  private start: Point | null = null;
  private baseline: {
    view: CanvasView;
    points: Point[];
    rect: CanvasRect;
  } | null = null;

  begin(id: number, point: Point, view: CanvasView, rect: CanvasRect) {
    const first = this.points.size === 0;
    const wasNavigating = this.navigating;
    if (first) {
      this.start = point;
      this.moved = false;
    }
    this.points.set(id, point);
    if (!wasNavigating) this.view = { ...view };
    if (this.points.size >= 2) {
      this.navigating = true;
      this.rebase(rect);
    }
    return first
      ? "first"
      : !wasNavigating && this.navigating
        ? "navigation-start"
        : "navigation";
  }

  move(id: number, point: Point): CanvasView | null {
    if (![point.x, point.y].every(Number.isFinite)) return null;
    const previous = this.points.get(id);
    if (!previous) return null;
    if (previous.x === point.x && previous.y === point.y)
      return this.navigating ? this.view : null;
    this.points.set(id, point);
    if (
      this.start &&
      Math.hypot(point.x - this.start.x, point.y - this.start.y) >= 6
    )
      this.moved = true;
    if (!this.navigating || !this.baseline) return null;
    const { view, rect, points } = this.baseline;
    const now = [...this.points.values()].slice(0, 2),
      a = center(points),
      b = center(now);
    const ratio =
      Math.min(
        30000,
        Math.max(150, (view.width * separation(points)) / separation(now)),
      ) / view.width;
    const scale = Math.min(rect.width / view.width, rect.height / view.height);
    if (!Number.isFinite(scale) || scale <= 0) return null;
    const anchor = {
      x:
        view.x +
        (a.x - rect.left - (rect.width - view.width * scale) / 2) / scale,
      y:
        view.y +
        (a.y - rect.top - (rect.height - view.height * scale) / 2) / scale,
    };
    this.view = {
      x: anchor.x - (anchor.x - view.x) * ratio - ((b.x - a.x) / scale) * ratio,
      y: anchor.y - (anchor.y - view.y) * ratio - ((b.y - a.y) / scale) * ratio,
      width: view.width * ratio,
      height: view.height * ratio,
    };
    return this.view;
  }

  end(id: number) {
    if (!this.points.has(id)) return null;
    const navigation = this.navigating;
    this.points.delete(id);
    const finished = this.points.size === 0;
    if (finished) this.reset();
    else if (navigation && this.baseline) this.rebase(this.baseline.rect);
    return { navigation, finished };
  }

  reset() {
    this.points.clear();
    this.navigating = false;
    this.moved = false;
    this.view = null;
    this.start = null;
    this.baseline = null;
  }

  private rebase(rect: CanvasRect) {
    if (this.view)
      this.baseline = {
        view: { ...this.view },
        points: [...this.points.values()].slice(0, 2),
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      };
  }
}
