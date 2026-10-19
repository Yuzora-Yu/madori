import WallDimension from "../app/floorplan/WallDimension";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PointMemo from "../app/floorplan/PointMemo";
import PlanItem from "../app/floorplan/PlanItem";
import { wallDimensionLayout } from "../packages/floorplan/annotations";
import {
  openingPlacement,
  resizeRoomInterior,
} from "../packages/floorplan/geometry";
import {
  addPointNote,
  addWall,
  bounds,
  emptyProject,
  moveItem,
  parseProject,
  placeFixture,
  resizeWall,
  rooms,
  translatePointLabel,
} from "../packages/floorplan/model";

function entrance() {
  const p = emptyProject();
  for (const [x, y, xx, yy] of [
    [0, 0, 140, 0],
    [140, 0, 140, 120],
    [140, 120, 0, 120],
    [0, 120, 0, 0],
  ])
    addWall(p, { x, y }, { x: xx, y: yy });
  return p;
}
describe("annotation editing and free cabinet doors", () => {
  it("resizes outlet symbols independently of mounting height and preserves a selectable target", () => {
    const p = entrance(),
      outlet = placeFixture(p, "outlet", { x: 0, y: 60 });
    outlet.width = 6;
    outlet.depth = 4;
    const render = () =>
      renderToStaticMarkup(
        createElement(PlanItem, {
          item: outlet,
          selected: false,
          onPointerDown: () => {},
        }),
      );
    const small = render();
    expect(small).toContain(`transform="scale(${6 / 26} ${4 / 26})"`);
    expect(small).toContain('x="-13" y="-13" width="26" height="26"');
    outlet.height = 85;
    expect(render().match(/class="outlet-symbol"[^>]+/)?.[0]).toBe(
      small.match(/class="outlet-symbol"[^>]+/)?.[0],
    );
    expect(render()).toContain("床から 85 cm");
    expect(parseProject(JSON.stringify(p)).items[0]).toMatchObject({
      width: 6,
      depth: 4,
      height: 85,
    });
    outlet.width = 1;
    outlet.depth = 1;
    expect(render()).toContain(`transform="scale(${1 / 26} ${1 / 26})"`);
  });

  it("hides one inner dimension without changing its wall, measured length or saved label position", () => {
    const p = entrance(),
      w = p.walls[0];
    w.dimensionOffset = 1800;
    const before = structuredClone(w),
      visibleBounds = bounds(p);
    const render = () =>
      renderToStaticMarkup(
        createElement(WallDimension, {
          entry: wallDimensionLayout(p, w, rooms(p)),
          selected: false,
          hidden: w.dimensionHidden,
          onPointerDown: () => {},
        }),
      );
    expect(render()).toContain("128 cm 内寸");
    w.dimensionHidden = true;
    expect(render()).toBe("");
    expect(bounds(p).height).toBeLessThan(visibleBounds.height);
    const restored = parseProject(JSON.stringify(p));
    expect(restored.walls[0]).toEqual({ ...before, dimensionHidden: true });
    expect(restored.walls.slice(1)).toEqual(p.walls.slice(1));
    w.dimensionHidden = false;
    expect(render()).toContain("128 cm 内寸");
    expect({ ...w, dimensionHidden: undefined }).toEqual({
      ...before,
      dimensionHidden: undefined,
    });
    expect(
      parseProject(JSON.stringify(entrance())).walls[0].dimensionHidden,
    ).toBeUndefined();
    expect(() =>
      parseProject(
        JSON.stringify({
          ...p,
          walls: [{ ...w, dimensionHidden: "false" }, ...p.walls.slice(1)],
        }),
      ),
    ).toThrow();
  });

  it("moves note text without changing its measured anchor and includes it in saved output bounds", () => {
    const p = entrance(),
      n = addPointNote(p, { x: 45.5, y: 71.2 });
    n.text = "土間の幅85 cm";
    const original = structuredClone(n);
    const moved = translatePointLabel(n, 600, -300);
    expect({ x: moved.x, y: moved.y }).toEqual({ x: 45.5, y: 71.2 });
    expect(moved.labelOffset).toEqual({ x: 616, y: -334 });
    expect(n).toEqual(original);
    p.notes = [moved];
    expect(bounds(p).x + bounds(p).width).toBeGreaterThan(661.5);
    expect(bounds(p).y).toBeLessThan(-262.8);
    expect(parseProject(JSON.stringify(p)).notes[0]).toEqual(moved);
    expect(translatePointLabel(n, Infinity, 0)).toBe(n);
    expect(translatePointLabel(n, 2001, 0)).toBe(n);
    const html = renderToStaticMarkup(
      createElement(PointMemo, {
        entry: moved,
        selected: false,
        onPointerDown: () => {},
      }),
    );
    expect(html).toContain('transform="translate(45.5 71.2)"');
    expect(html).toContain('x="616" y="-334"');
    expect(html).toContain('d="M0 0 L616 -306"');
  });
  it("places small entrance dimensions on the room side and changes only annotation position when dragged", () => {
    const p = entrance(),
      before = structuredClone(p.walls),
      roomList = rooms(p);
    const w = p.walls[0],
      layout = wallDimensionLayout(p, w, roomList);
    expect(layout.label.y).toBeGreaterThan(0);
    expect(layout.label.y).toBeLessThan(120);
    expect(layout.value).toBe(128);
    w.dimensionOffset = -45;
    const next = wallDimensionLayout(p, w, roomList);
    expect(next.value).toBe(layout.value);
    expect(w.a).toEqual(before[0].a);
    expect(w.b).toEqual(before[0].b);
    expect(next.label.y).toBe(40);
    expect(parseProject(JSON.stringify(p)).walls[0].dimensionOffset).toBe(-45);
  });
  it("keeps cabinet doors free near walls and independent of wall resizing", () => {
    const p = entrance(),
      door = placeFixture(p, "cabinetDoor", { x: 40, y: 3 });
    expect(door).toMatchObject({
      x: 40,
      y: 3,
      wallSnap: false,
      baseElevation: 85,
      width: 45,
    });
    door.rotation = 37;
    moveItem(p, door, { x: 45.2, y: 2.8 });
    expect(door).toMatchObject({ x: 45.2, y: 2.8, rotation: 37 });
    expect(openingPlacement(p, door)).toBeNull();
    resizeRoomInterior(p, rooms(p)[0], "x", 200);
    expect(p.items[0]).toMatchObject({ x: 45.2, y: 2.8, rotation: 37 });
    expect(parseProject(JSON.stringify(p)).items[0]).toEqual(p.items[0]);
    const html = renderToStaticMarkup(
      createElement(PlanItem, {
        item: door,
        selected: false,
        onPointerDown: () => {},
      }),
    );
    expect(html).not.toContain('stroke-width="16"');
  });
  it("disables magnetic movement and wall following for an ordinary door while preserving default snapping", () => {
    const p = entrance(),
      door = placeFixture(p, "door", { x: 45, y: 3 });
    expect(door.y).toBe(0);
    door.wallSnap = false;
    door.rotation = 23;
    moveItem(p, door, { x: 45.2, y: 2.8 });
    expect(door).toMatchObject({ x: 45.2, y: 2.8, rotation: 23 });
    resizeWall(p, p.walls[0].id, 200);
    expect(door).toMatchObject({ x: 45.2, y: 2.8, rotation: 23 });
    expect(openingPlacement(p, door)).toBeNull();
    door.wallSnap = true;
    moveItem(p, door, { x: 45, y: 3 });
    expect(door.y).toBe(0);
    expect(door.rotation).toBe(0);
  });
  it("migrates version 4 without moving geometry or existing note labels and validates new fields", () => {
    const p = entrance();
    addPointNote(p, { x: 30, y: 40 }).text = "旧メモ";
    const legacy = { ...p, formatVersion: 4 };
    const restored = parseProject(JSON.stringify(legacy));
    expect(restored.formatVersion).toBe(5);
    expect(restored.walls).toEqual(p.walls);
    expect(restored.notes).toEqual(p.notes);
    for (const labelOffset of [
      { x: null, y: 0 },
      { x: 2001, y: 0 },
      { x: 0, y: "10" },
    ]) {
      expect(() =>
        parseProject(
          JSON.stringify({ ...p, notes: [{ ...p.notes[0], labelOffset }] }),
        ),
      ).toThrow();
    }
    expect(() =>
      parseProject(
        JSON.stringify({
          ...p,
          walls: [{ ...p.walls[0], dimensionOffset: "5" }, ...p.walls.slice(1)],
        }),
      ),
    ).toThrow();
    const item = placeFixture(p, "door", { x: 30, y: 0 });
    expect(() =>
      parseProject(
        JSON.stringify({ ...p, items: [{ ...item, wallSnap: "false" }] }),
      ),
    ).toThrow();
  });
});
