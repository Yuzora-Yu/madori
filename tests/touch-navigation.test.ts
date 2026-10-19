import { describe, expect, it } from "vitest";
import { TouchNavigation } from "../packages/floorplan/touch-navigation";

const view = { x: 0, y: 0, width: 1000, height: 500 };
const rect = { left: 100, top: 50, width: 1000, height: 500 };
describe("touch navigation", () => {
  it("separates tap jitter from single-finger dragging and starts navigation with a second finger", () => {
    const nav = new TouchNavigation();
    expect(nav.begin(1, { x: 300, y: 200 }, view, rect)).toBe("first");
    expect(nav.move(1, { x: 302, y: 201 })).toBeNull();
    expect(nav.moved).toBe(false);
    nav.move(1, { x: 310, y: 201 });
    expect(nav.moved).toBe(true);
    expect(nav.begin(2, { x: 500, y: 200 }, view, rect)).toBe(
      "navigation-start",
    );
    expect(nav.navigating).toBe(true);
  });
  it("combines a pinch and pan while preserving the world point under the finger midpoint", () => {
    const nav = new TouchNavigation();
    nav.begin(1, { x: 300, y: 200 }, view, rect);
    nav.begin(2, { x: 500, y: 200 }, view, rect);
    nav.move(1, { x: 300, y: 250 });
    const next = nav.move(2, { x: 700, y: 250 })!;
    expect(next).toEqual({ x: 100, y: 50, width: 500, height: 250 });
    // Original midpoint was world (300,150); new midpoint is screen (500,250).
    expect(next.x + ((500 - rect.left) * next.width) / rect.width).toBe(300);
    expect(next.y + ((250 - rect.top) * next.height) / rect.height).toBe(150);
  });
  it("pans without zooming, and keeps the last finger in navigation until it lifts", () => {
    const nav = new TouchNavigation();
    nav.begin(1, { x: 300, y: 200 }, view, rect);
    nav.begin(2, { x: 500, y: 200 }, view, rect);
    nav.move(1, { x: 330, y: 220 });
    expect(nav.move(2, { x: 530, y: 220 })).toEqual({
      ...view,
      x: -30,
      y: -20,
    });
    expect(nav.end(1)).toEqual({ navigation: true, finished: false });
    expect(nav.move(2, { x: 550, y: 230 })).toEqual({
      ...view,
      x: -50,
      y: -30,
    });
    expect(nav.navigating).toBe(true);
    expect(nav.end(2)).toEqual({ navigation: true, finished: true });
    expect(nav.navigating).toBe(false);
    expect(nav.begin(3, { x: 300, y: 200 }, view, rect)).toBe("first");
    expect(nav.move(2, { x: 300, y: 200 })).toBeNull();
  });
  it("rebases extra fingers and either lift order without jumping", () => {
    const nav = new TouchNavigation();
    nav.begin(1, { x: 300, y: 200 }, view, rect);
    nav.begin(2, { x: 500, y: 200 }, view, rect);
    const changed = nav.move(2, { x: 700, y: 250 })!;
    nav.begin(3, { x: 500, y: 300 }, view, rect);
    expect(nav.move(3, { x: 500, y: 300 })).toEqual(changed);
    nav.end(1);
    expect(nav.move(2, { x: 700, y: 250 })).toEqual(changed);
    nav.end(3);
    expect(nav.move(2, { x: 700, y: 250 })).toEqual(changed);
  });
  it("handles non-enumerable DOM rectangles and a letterboxed SVG viewport", () => {
    const nav = new TouchNavigation();
    const box = Object.create(null);
    for (const [k, v] of Object.entries({ ...rect, width: 1000, height: 1000 }))
      Object.defineProperty(box, k, { get: () => v });
    nav.begin(1, { x: 300, y: 550 }, view, box);
    nav.begin(2, { x: 500, y: 550 }, view, box);
    const next = nav.move(2, { x: 700, y: 550 })!;
    expect(next.width).toBe(500);
    expect(next.y).toBe(125);
    expect(Number.isFinite(next.x)).toBe(true);
  });
  it("limits zoom, handles overlapping fingers and resets cleanly on cancellation", () => {
    const nav = new TouchNavigation();
    nav.begin(1, { x: 100, y: 100 }, view, rect);
    nav.begin(2, { x: 100, y: 100 }, view, rect);
    expect(nav.move(2, { x: 100, y: 100 })).toEqual(view);
    expect(nav.move(2, { x: 10000, y: 100 })!.width).toBe(150);
    expect(nav.move(2, { x: NaN, y: 100 })).toBeNull();
    nav.reset();
    expect(nav.points.size).toBe(0);
    expect(nav.end(2)).toBeNull();
    nav.begin(1, { x: 100, y: 100 }, { ...view, width: 20000 }, rect);
    nav.begin(2, { x: 10100, y: 100 }, { ...view, width: 20000 }, rect);
    expect(nav.move(2, { x: 100, y: 100 })!.width).toBe(30000);
  });
});
