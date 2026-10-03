import { describe, expect, it } from "vitest";
import {
  addWall,
  demoProject,
  distance,
  emptyProject,
  moveItem,
  parseProject,
  placeFixture,
  resizeWall,
  rooms,
} from "../packages/floorplan/model";
describe("local floor plan geometry and persistence", () => {
  it("keeps an attached window on its wall after dimension correction", () => {
    const p = emptyProject();
    addWall(p, { x: 0, y: 0 }, { x: 400, y: 0 });
    const window = placeFixture(p, "window", { x: 200, y: 0 });
    resizeWall(p, p.walls[0].id, 600);
    expect(window.x).toBeCloseTo(300);
    expect(window.y).toBe(0);
  });
  it("detects five sample rooms with the expected total floor area", () => {
    const result = rooms(demoProject());
    expect(result).toHaveLength(5);
    expect(result.reduce((s, r) => s + r.area, 0)).toBeCloseTo(58.5);
  });
  it("splits a rectangular room at wall intersections", () => {
    const p = emptyProject();
    for (const [x, y, xx, yy] of [
      [0, 0, 400, 0],
      [400, 0, 400, 300],
      [400, 300, 0, 300],
      [0, 300, 0, 0],
      [200, 0, 200, 300],
    ])
      addWall(p, { x, y }, { x: xx, y: yy });
    const result = rooms(p);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.area)).toEqual([6, 6]);
  });
  it("does not report an open wall chain as a room", () => {
    const p = emptyProject();
    addWall(p, { x: 0, y: 0 }, { x: 300, y: 0 });
    addWall(p, { x: 300, y: 0 }, { x: 300, y: 300 });
    expect(rooms(p)).toEqual([]);
  });
  it("changes a hand drawn wall length and keeps connected endpoints together", () => {
    const p = emptyProject();
    addWall(p, { x: 0, y: 0 }, { x: 200, y: 0 });
    addWall(p, { x: 200, y: 0 }, { x: 200, y: 200 });
    resizeWall(p, p.walls[0].id, 350);
    expect(distance(p.walls[0].a, p.walls[0].b)).toBe(350);
    expect(p.walls[1].a).toEqual({ x: 350, y: 0 });
  });
  it("aligns openings with nearby walls and preserves freestanding fixtures", () => {
    const p = emptyProject();
    addWall(p, { x: 0, y: 0 }, { x: 0, y: 600 });
    const door = placeFixture(p, "door", { x: 15, y: 120 });
    expect(door.x).toBe(0);
    expect(door.rotation).toBe(90);
    moveItem(p, door, { x: 20, y: 220 });
    expect(door.y).toBeCloseTo(220);
    const bath = placeFixture(p, "bath", { x: 35, y: 40 });
    expect(bath.x).toBe(35);
  });
  it("round trips every stored input without changing it", () => {
    const p = demoProject();
    expect(parseProject(JSON.stringify(p))).toEqual(p);
    expect(demoProject()).toEqual(p);
  });
  it("rejects unknown formats, broken dimensions, duplicate IDs and invalid references", () => {
    const p = demoProject();
    expect(() =>
      parseProject(JSON.stringify({ ...p, formatVersion: 2 })),
    ).toThrow("対応していない");
    const bad = structuredClone(p);
    bad.items[0].width = -1;
    expect(() => parseProject(JSON.stringify(bad))).toThrow();
    const dup = structuredClone(p);
    dup.items[1].id = dup.items[0].id;
    expect(() => parseProject(JSON.stringify(dup))).toThrow();
    const missing = structuredClone(p);
    missing.items[0].furnitureId = "unknown";
    expect(() => parseProject(JSON.stringify(missing))).toThrow();
  });
});
