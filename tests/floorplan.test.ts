import {
  doorPose,
  shelfBoards,
  interiorRoom,
  wallInteriorLength,
  resizeRoomInterior,
} from "../packages/floorplan/geometry";
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
      parseProject(JSON.stringify({ ...p, formatVersion: 99 })),
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

function rectangle(width = 400, depth = 300) {
  const p = emptyProject();
  for (const [x, y, xx, yy] of [
    [0, 0, width, 0],
    [width, 0, width, depth],
    [width, depth, 0, depth],
    [0, depth, 0, 0],
  ])
    addWall(p, { x, y }, { x: xx, y: yy });
  return p;
}
describe("interior measurements, doors and built-in shelves", () => {
  it("subtracts asymmetric wall thickness and reports usable floor area", () => {
    const p = rectangle();
    p.walls[0].thickness = 20;
    p.walls[1].thickness = 16;
    p.walls[2].thickness = 10;
    p.walls[3].thickness = 24;
    const m = interiorRoom(p, rooms(p)[0]);
    expect(m.width).toBe(380);
    expect(m.depth).toBe(285);
    expect(m.area).toBeCloseTo(10.83);
    expect(wallInteriorLength(p, p.walls[0])).toBe(380);
  });
  it("computes the interior area of an L-shaped room", () => {
    const p = emptyProject(),
      points = [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 200 },
        { x: 200, y: 200 },
        { x: 200, y: 400 },
        { x: 0, y: 400 },
      ];
    points.forEach((a, i) => addWall(p, a, points[(i + 1) % points.length]));
    const m = interiorRoom(p, rooms(p)[0]);
    expect(m.rectangular).toBe(false);
    expect(m.area).toBeCloseTo((388 * 188 + 188 * 200) / 10000);
  });
  it("sets exact room interior dimensions and keeps openings and adjoining walls together", () => {
    const p = rectangle(800, 600);
    addWall(p, { x: 400, y: 0 }, { x: 400, y: 600 });
    addWall(p, { x: 0, y: 300 }, { x: 400, y: 300 });
    const door = placeFixture(p, "door", { x: 400, y: 150 });
    door.rotation = 270;
    p.labels.push({ x: 200, y: 150, name: "A", color: "#ffffff" });
    const room = rooms(p).find((r) => r.center.x < 400 && r.center.y < 300)!;
    resizeRoomInterior(p, room, "x", 450);
    expect(rooms(p)).toHaveLength(3);
    const result = rooms(p).find((r) => r.center.x < 462 && r.center.y < 300)!;
    expect(interiorRoom(p, result).width).toBe(450);
    expect(p.walls.filter((w) => w.a.x === 462 && w.b.x === 462)).toHaveLength(
      2,
    );
    expect(p.items[0].x).toBe(462);
    expect(p.items[0].rotation).toBe(270);
    resizeRoomInterior(p, result, "y", 320);
    expect(
      interiorRoom(
        p,
        rooms(p).find((r) => r.center.x < 462 && r.center.y < 332)!,
      ).depth,
    ).toBe(320);
    const before = structuredClone(p);
    expect(() => resizeRoomInterior(p, rooms(p)[0], "x", 1200)).toThrow();
    expect(p).toEqual(before);
  });
  it("retains a flipped door when dragging or correcting a wall", () => {
    const p = rectangle(),
      door = placeFixture(p, "door", { x: 100, y: 0 });
    door.rotation = 180;
    moveItem(p, door, { x: 200, y: 5 });
    expect(door.rotation).toBe(180);
    resizeWall(p, p.walls[0].id, 500);
    expect(door.rotation).toBe(180);
  });
  for (const doorHinge of ["left", "right"] as const)
    for (const doorSwing of ["positive", "negative"] as const)
      it(`shares ${doorHinge}/${doorSwing} leaf endpoints between SVG and 3D`, () => {
        const p = rectangle(),
          door = placeFixture(p, "door", { x: 100, y: 0 });
        Object.assign(door, { doorHinge, doorSwing, doorAngle: 90 });
        const pose = doorPose(door);
        expect(pose.hinge.x).toBe(doorHinge === "left" ? -40 : 40);
        expect(pose.tip.y).toBeCloseTo(doorSwing === "positive" ? 80 : -80);
        // Three rotation.y = -angle maps its local X axis to plan (cos(angle), sin(angle)).
        expect(pose.center.x - 40 * Math.cos(pose.angle)).toBeCloseTo(
          pose.hinge.x,
        );
        expect(pose.center.y - 40 * Math.sin(pose.angle)).toBeCloseTo(
          pose.hinge.y,
        );
        door.doorAngle = 0;
        expect(doorPose(door).tip.x).toBeCloseTo(pose.closed.x);
        expect(doorPose(door).tip.y).toBeCloseTo(0);
        door.doorAngle = 180;
        expect(doorPose(door).tip.x).toBeCloseTo(
          pose.hinge.x + (doorHinge === "left" ? -80 : 80),
        );
      });
  it("makes bounded shelf boards and persists shelf and door settings", () => {
    const p = rectangle(),
      f = {
        ...p.furniture[0],
        id: "f-shelf",
        shape: "shelf" as const,
        shelfLevels: 5,
        baseElevation: 90,
        height: 150,
      };
    p.furniture.push(f);
    p.items.push({
      ...f,
      id: `i${p.nextId++}`,
      furnitureId: f.id,
      x: 100,
      y: 100,
      rotation: 90,
    });
    const d = placeFixture(p, "door", { x: 200, y: 0 });
    Object.assign(d, {
      doorHinge: "right",
      doorSwing: "negative",
      doorAngle: 45,
    });
    const boards = shelfBoards(f);
    expect(boards.heights).toHaveLength(6);
    expect(boards.heights[0] - boards.thickness / 2).toBe(0);
    expect(boards.heights.at(-1)! + boards.thickness / 2).toBe(150);
    expect(parseProject(JSON.stringify(p))).toEqual(p);
    for (const bad of [
      { shelfLevels: 0 },
      { shelfLevels: 1.5 },
      { baseElevation: -1 },
    ]) {
      const q = structuredClone(p);
      Object.assign(q.items[0], bad);
      expect(() => parseProject(JSON.stringify(q))).toThrow();
    }
  });
  it("explicitly migrates version 1 without moving the user's geometry", () => {
    const p = demoProject();
    const old = {
      ...structuredClone(p),
      formatVersion: 1,
      dimensionBasis: undefined,
    };
    old.items.forEach((i) => {
      delete i.doorHinge;
      delete i.doorSwing;
      delete i.doorAngle;
    });
    const migrated = parseProject(JSON.stringify(old));
    expect(migrated.formatVersion).toBe(2);
    expect(migrated.dimensionBasis).toBe("interior");
    expect(migrated.walls).toEqual(old.walls);
    expect(migrated.items.map((i) => [i.x, i.y, i.rotation])).toEqual(
      old.items.map((i) => [i.x, i.y, i.rotation]),
    );
    expect(migrated.items.find((i) => i.kind === "door")?.doorAngle).toBe(90);
  });
});

it("retains decimal precision when entering wall dimensions", () => {
  const p = emptyProject();
  addWall(p, { x: 0, y: 0 }, { x: 100, y: 0 });
  resizeWall(p, p.walls[0].id, 123.5);
  expect(distance(p.walls[0].a, p.walls[0].b)).toBeCloseTo(123.5, 8);
});
