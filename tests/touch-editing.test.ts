// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import Planner from "../app/floorplan/Planner";
import {
  addWall,
  emptyProject,
  STORAGE_KEY,
  type Project,
} from "../packages/floorplan/model";

let root: Root;
let original: Project;
const rect = { left: 100, top: 50, width: 1000, height: 600 };
const svg = () => document.querySelector<SVGSVGElement>(".plan-canvas")!;
const item = () =>
  document.querySelector<SVGGElement>(
    '.plan-item[aria-label="2人掛けソファ"]',
  )!;
const button = (label: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const point = (x: number, y: number) => {
  const m = svg().getScreenCTM()!;
  return { x: m.a * x + m.e, y: m.d * y + m.f };
};
async function pointer(
  target: Element,
  type: string,
  id: number,
  x: number,
  y: number,
  kind = "touch",
  mouseButton = 0,
) {
  await act(() => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: mouseButton,
      buttons: type === "pointerup" ? 0 : 1,
    });
    Object.defineProperties(event, {
      pointerId: { value: id },
      pointerType: { value: kind },
      isPrimary: { value: id === 1 },
    });
    target.dispatchEvent(event);
  });
}
async function saved() {
  await act(() => vi.advanceTimersByTime(500));
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Project;
}

beforeEach(async () => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "DOMPoint",
    class {
      constructor(
        public x: number,
        public y: number,
      ) {}
      matrixTransform(m: { a: number; d: number; e: number; f: number }) {
        return { x: this.x * m.a + m.e, y: this.y * m.d + m.f };
      }
    },
  );
  const captures = new Set<number>();
  Object.defineProperties(SVGSVGElement.prototype, {
    setPointerCapture: {
      configurable: true,
      value: (id: number) => captures.add(id),
    },
    hasPointerCapture: {
      configurable: true,
      value: (id: number) => captures.has(id),
    },
    releasePointerCapture: {
      configurable: true,
      value: function (this: SVGSVGElement, id: number) {
        captures.delete(id);
        const event = new Event("lostpointercapture", { bubbles: true });
        Object.defineProperty(event, "pointerId", { value: id });
        this.dispatchEvent(event);
      },
    },
    getScreenCTM: {
      configurable: true,
      value: function (this: SVGSVGElement) {
        const [x, y, w, h] = this.getAttribute("viewBox")!
            .split(" ")
            .map(Number),
          scale = Math.min(rect.width / w, rect.height / h);
        const e = rect.left + (rect.width - w * scale) / 2 - x * scale,
          f = rect.top + (rect.height - h * scale) / 2 - y * scale;
        return {
          a: scale,
          d: scale,
          e,
          f,
          inverse: () => ({
            a: 1 / scale,
            d: 1 / scale,
            e: -e / scale,
            f: -f / scale,
          }),
        };
      },
    },
    getBoundingClientRect: { configurable: true, value: () => ({ ...rect }) },
  });
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();
  localStorage.clear();
  original = emptyProject();
  for (const [x, y, xx, yy] of [
    [0, 0, 600, 0],
    [600, 0, 600, 400],
    [600, 400, 0, 400],
    [0, 400, 0, 0],
  ])
    addWall(original, { x, y }, { x: xx, y: yy });
  original.items.push({
    ...original.furniture[0],
    id: `i${original.nextId++}`,
    furnitureId: original.furniture[0].id,
    x: 150,
    y: 150,
    rotation: 0,
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(original));
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => root.render(createElement(Planner)));
});
afterEach(async () => {
  await act(() => root.unmount());
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("touch editing boundaries", () => {
  it("ignores tap jitter and commits one-finger furniture dragging as one undoable operation", async () => {
    const p = point(150, 150),
      before = item().getAttribute("transform");
    await pointer(item(), "pointerdown", 1, p.x, p.y);
    await pointer(svg(), "pointermove", 1, p.x + 2, p.y + 2);
    await pointer(svg(), "pointerup", 1, p.x + 2, p.y + 2);
    expect(item().getAttribute("transform")).toBe(before);
    expect(button("元に戻す").disabled).toBe(true);
    await pointer(item(), "pointerdown", 1, p.x, p.y);
    await pointer(svg(), "pointermove", 1, p.x + 45, p.y + 20);
    await pointer(svg(), "pointerup", 1, p.x + 45, p.y + 20);
    expect((await saved()).items[0].x).toBeGreaterThan(original.items[0].x);
    await act(() => button("元に戻す").click());
    expect((await saved()).items).toEqual(original.items);
    expect(button("元に戻す").disabled).toBe(true);
  });
  it("rolls back an in-progress edit when a second finger starts navigation and never resumes editing with a remaining finger", async () => {
    const p = point(150, 150),
      before = item().getAttribute("transform"),
      initialView = svg().getAttribute("viewBox");
    await pointer(item(), "pointerdown", 1, p.x, p.y);
    await pointer(svg(), "pointermove", 1, p.x + 40, p.y + 20);
    expect(item().getAttribute("transform")).not.toBe(before);
    await pointer(svg(), "pointerdown", 2, p.x + 180, p.y + 20);
    expect(item().getAttribute("transform")).toBe(before);
    await pointer(svg(), "pointermove", 2, p.x + 260, p.y + 50);
    expect(svg().getAttribute("viewBox")).not.toBe(initialView);
    await pointer(svg(), "pointerup", 1, p.x + 40, p.y + 20);
    await pointer(svg(), "pointermove", 2, p.x + 280, p.y + 50);
    await pointer(svg(), "pointerup", 2, p.x + 280, p.y + 50);
    expect(await saved()).toEqual(original);
    expect(button("元に戻す").disabled).toBe(true);
  });
  it("defers fixture placement until a single finger lifts, so pinching in a placement tool creates nothing", async () => {
    await act(() => button("窓").click());
    const p = point(200, 0);
    await pointer(svg(), "pointerdown", 1, p.x, p.y);
    expect(document.querySelectorAll(".plan-item")).toHaveLength(1);
    await pointer(svg(), "pointerdown", 2, p.x + 180, p.y);
    await pointer(svg(), "pointermove", 2, p.x + 240, p.y);
    await pointer(svg(), "pointerup", 2, p.x + 240, p.y);
    await pointer(svg(), "pointerup", 1, p.x, p.y);
    expect(await saved()).toEqual(original);
    const next = point(200, 0);
    await pointer(svg(), "pointerdown", 1, next.x, next.y);
    await pointer(svg(), "pointerup", 1, next.x, next.y);
    expect((await saved()).items).toHaveLength(2);
    expect(button("選択").getAttribute("aria-pressed")).toBe("true");
  });
  it("abandons a draft wall when navigating but still draws walls with one finger", async () => {
    await act(() => button("壁を描く").click());
    const a = point(150, 250),
      b = point(300, 250);
    await pointer(svg(), "pointerdown", 1, a.x, a.y);
    await pointer(svg(), "pointermove", 1, b.x, b.y);
    await pointer(svg(), "pointerdown", 2, b.x + 180, b.y);
    await pointer(svg(), "pointerup", 2, b.x + 180, b.y);
    await pointer(svg(), "pointerup", 1, b.x, b.y);
    expect(await saved()).toEqual(original);
    const c = point(150, 250),
      d = point(300, 250);
    await pointer(svg(), "pointerdown", 1, c.x, c.y);
    await pointer(svg(), "pointermove", 1, d.x, d.y);
    await pointer(svg(), "pointerup", 1, d.x, d.y);
    expect((await saved()).walls).toHaveLength(original.walls.length + 1);
  });
  it.each(["pointercancel", "lostpointercapture"])(
    "restores the project on %s and allows the next gesture",
    async (type) => {
      const p = point(150, 150);
      await pointer(item(), "pointerdown", 1, p.x, p.y);
      await pointer(svg(), "pointermove", 1, p.x + 50, p.y);
      await pointer(svg(), type, 1, p.x + 50, p.y);
      expect(await saved()).toEqual(original);
      expect(button("元に戻す").disabled).toBe(true);
      await pointer(item(), "pointerdown", 2, p.x, p.y);
      await pointer(svg(), "pointermove", 2, p.x + 50, p.y);
      await pointer(svg(), "pointerup", 2, p.x + 50, p.y);
      expect((await saved()).items[0].x).toBeGreaterThan(150);
    },
  );
  it("keeps mouse right-drag navigation working without moving furniture", async () => {
    const p = point(150, 150),
      before = svg().getAttribute("viewBox");
    await pointer(item(), "pointerdown", 1, p.x, p.y, "mouse", 2);
    await pointer(svg(), "pointermove", 1, p.x + 80, p.y + 30, "mouse");
    await pointer(svg(), "pointerup", 1, p.x + 80, p.y + 30, "mouse");
    expect(svg().getAttribute("viewBox")).not.toBe(before);
    expect(await saved()).toEqual(original);
  });
  it("cancels an edit when another panel opens or the window loses focus", async () => {
    const p = point(150, 150);
    await pointer(item(), "pointerdown", 1, p.x, p.y);
    await pointer(svg(), "pointermove", 1, p.x + 50, p.y);
    await act(() => document.getElementById("details-toggle")!.click());
    expect(await saved()).toEqual(original);
    await pointer(item(), "pointerdown", 2, p.x, p.y);
    await pointer(svg(), "pointermove", 2, p.x + 50, p.y);
    await act(() => window.dispatchEvent(new Event("blur")));
    expect(await saved()).toEqual(original);
    expect(button("元に戻す").disabled).toBe(true);
  });
});
