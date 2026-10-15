import { furniturePosition } from "../packages/floorplan/movement";
import {
  furnitureCallouts,
  annotationBounds,
  windowDimensionEntries,
  rasterSize,
} from "../packages/floorplan/annotations";
import {
  openingPlacement,
  setOpeningGap,
  resizeOpeningWidth,
  windowElevation,
  doorPose,
  shelfBoards,
  interiorRoom,
  wallInteriorLength,
  resizeRoomInterior,
} from "../packages/floorplan/geometry";
import { describe, expect, it } from "vitest";
import {
  translateDimensionNote,
  addPointNote,
  translatePointNote,
  removeDoorLeaf,
  addDimensionNote,
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
    expect(migrated.formatVersion).toBe(4);
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

describe("window measurements from the interior wall face", () => {
  it("measures to window edges and subtracts the adjoining walls", () => {
    const p = rectangle();
    p.walls[1].thickness = 20;
    p.walls[3].thickness = 16;
    const w = placeFixture(p, "window", { x: 200, y: 0 }),
      m = openingPlacement(p, w)!;
    expect(m.labelA).toBe("左の内壁から");
    expect(m.labelB).toBe("右の内壁から");
    expect(m.available).toBe(382);
    expect(m.gapA).toBe(117);
    expect(m.gapB).toBe(115);
    expect(m.gapA + w.width + m.gapB).toBe(m.available);
  });
  it("keeps left and right reference sides stable when walls and windows are reversed", () => {
    const p = rectangle(),
      w = placeFixture(p, "window", { x: 150, y: 0 });
    const before = openingPlacement(p, w)!;
    const wall = p.walls[0];
    [wall.a, wall.b] = [wall.b, wall.a];
    w.rotation = 180;
    const after = openingPlacement(p, w)!;
    expect(after.start).toEqual(before.start);
    expect(after.end).toEqual(before.end);
    expect(after.gapA).toBeCloseTo(before.gapA);
    expect(after.gapB).toBeCloseTo(before.gapB);
  });
  it("places vertical windows from the top or bottom using decimal distances", () => {
    const p = rectangle(),
      w = placeFixture(p, "window", { x: 400, y: 150 });
    w.width = 80;
    const m = openingPlacement(p, w)!;
    expect(m.labelA).toBe("上の内壁から");
    expect(m.labelB).toBe("下の内壁から");
    setOpeningGap(p, w.id, "a", 23.5);
    expect(w.x).toBe(400);
    expect(w.y).toBeCloseTo(69.5);
    expect(openingPlacement(p, w)!.gapA).toBeCloseTo(23.5);
    setOpeningGap(p, w.id, "b", 40.25);
    expect(w.y).toBeCloseTo(213.75);
    expect(openingPlacement(p, w)!.gapB).toBeCloseTo(40.25);
  });
  it("changes window width while retaining the first inner gap and rejects overflow without mutation", () => {
    const p = rectangle(),
      w = placeFixture(p, "window", { x: 200, y: 0 });
    setOpeningGap(p, w.id, "a", 50);
    resizeOpeningWidth(p, w.id, 220.5);
    expect(openingPlacement(p, w)!.gapA).toBeCloseTo(50);
    expect(w.x).toBeCloseTo(166.25);
    const before = structuredClone(p);
    expect(() => resizeOpeningWidth(p, w.id, 350)).toThrow("収まりません");
    expect(p).toEqual(before);
    for (const gap of [-1, 300, NaN, Infinity]) {
      expect(() => setOpeningGap(p, w.id, "b", gap)).toThrow();
      expect(p).toEqual(before);
    }
  });
  it("supports zero gaps and oblique aligned walls", () => {
    const p = emptyProject();
    addWall(p, { x: 0, y: 0 }, { x: 300, y: 400 });
    const w = placeFixture(p, "window", { x: 150, y: 200 });
    setOpeningGap(p, w.id, "a", 0);
    expect(w.x).toBeCloseTo(45);
    expect(w.y).toBeCloseTo(60);
    expect(openingPlacement(p, w)!.labelA).toBe("A側の内壁から");
    setOpeningGap(p, w.id, "b", 0);
    expect(w.x).toBeCloseTo(255);
    expect(w.y).toBeCloseTo(340);
  });
  it("requires wall alignment for relative offsets but allows standalone dimensions", () => {
    const p = rectangle(),
      w = placeFixture(p, "window", { x: 200, y: 150 });
    expect(openingPlacement(p, w)).toBeNull();
    expect(() => setOpeningGap(p, w.id, "a", 10)).toThrow("壁に沿わせて");
    resizeOpeningWidth(p, w.id, 100);
    expect(w.width).toBe(100);
    expect(w.x).toBe(200);
    w.x = 200;
    w.y = 0;
    w.rotation = 90;
    expect(openingPlacement(p, w)).toBeNull();
  });
  it("persists exact position, size and elevation without changing the project format", () => {
    const p = rectangle(),
      w = placeFixture(p, "window", { x: 200, y: 0 });
    expect(windowElevation(w)).toBe(90);
    setOpeningGap(p, w.id, "a", 32.75);
    resizeOpeningWidth(p, w.id, 145.5);
    w.height = 125;
    w.baseElevation = 65;
    const restored = parseProject(JSON.stringify(p)),
      copy = restored.items[0];
    expect(restored).toEqual(p);
    expect(openingPlacement(restored, copy)!.gapA).toBeCloseTo(32.75);
    expect(windowElevation(copy)).toBe(65);
    copy.baseElevation = 0;
    expect(windowElevation(copy)).toBe(0);
  });
});

describe("free dimension notes and furniture name leaders", () => {
  it("stores measured values separately from drawn length without moving the plan", () => {
    const p = rectangle(),
      walls = structuredClone(p.walls),
      items = structuredClone(p.items);
    const d = addDimensionNote(p, { x: 20, y: 30 }, { x: 140, y: 30 });
    d.value = 118.25;
    d.note = "窓下・収納棚を置く";
    expect(distance(d.a, d.b)).toBe(120);
    expect(d.value).toBe(118.25);
    expect(p.walls).toEqual(walls);
    expect(p.items).toEqual(items);
    expect(parseProject(JSON.stringify(p))).toEqual(p);
  });
  it("rejects invalid annotation fields and protects unsupported project formats", () => {
    const p = rectangle(),
      d = addDimensionNote(p, { x: 0, y: 0 }, { x: 100, y: 0 });
    for (const bad of [
      { value: -1 },
      { value: 0 },
      { note: "x".repeat(201) },
      { a: { x: NaN, y: 0 } },
      { b: { x: 0, y: 0 } },
      { id: p.walls[0].id },
    ]) {
      const q = structuredClone(p);
      Object.assign(q.dimensions[0], bad);
      expect(() => parseProject(JSON.stringify(q))).toThrow();
    }
    expect(() =>
      addDimensionNote(p, { x: NaN, y: 0 }, { x: 50, y: 0 }),
    ).toThrow();
    expect(() =>
      addDimensionNote(p, { x: 0, y: 0 }, { x: 0.5, y: 0 }),
    ).toThrow();
    expect(p.dimensions).toHaveLength(1);
    expect(d.id).toMatch(/^m/);
    expect(() =>
      parseProject(JSON.stringify({ ...p, dimensions: undefined })),
    ).toThrow("寸法メモ");
  });
  it("explicitly upgrades version 2 without changing windows, rooms or furniture", () => {
    const p = demoProject(),
      legacy = { ...p, formatVersion: 2, dimensions: undefined };
    const migrated = parseProject(JSON.stringify(legacy));
    expect(migrated.formatVersion).toBe(4);
    expect(migrated.dimensions).toEqual([]);
    expect(migrated.walls).toEqual(p.walls);
    expect(migrated.items).toEqual(p.items);
    expect(migrated.labels).toEqual(p.labels);
    expect(migrated.nextId).toBe(p.nextId);
  });
  it("places deterministic labels beyond outer walls without stacking labels at the same height", () => {
    const p = demoProject();
    p.items
      .filter((i) => !i.kind)
      .forEach((i) => {
        i.x = 100;
        i.y = 200;
      });
    const before = structuredClone(p),
      labels = furnitureCallouts(p);
    expect(labels).toHaveLength(6);
    expect(labels.every((c) => c.side === "left" && c.x + c.width < 0)).toBe(
      true,
    );
    for (let i = 1; i < labels.length; i++)
      expect(labels[i].y - labels[i - 1].y).toBeGreaterThanOrEqual(34);
    expect(furnitureCallouts(p)).toEqual(labels);
    expect(p).toEqual(before);
    const box = annotationBounds(p, labels);
    expect(
      labels.every(
        (c) =>
          c.x >= box.x &&
          c.x + c.width <= box.x + box.width &&
          c.y >= box.y &&
          c.y <= box.y + box.height,
      ),
    ).toBe(true);
  });
});

it("moves dimension notes without changing measured values and prevents invalid coordinates", () => {
  const p = rectangle(),
    d = addDimensionNote(p, { x: 30, y: 40 }, { x: 130, y: 40 });
  d.value = 98;
  d.note = "棚の幅";
  const moved = translateDimensionNote(d, 10, -20);
  expect(moved.a).toEqual({ x: 40, y: 20 });
  expect(moved.b).toEqual({ x: 140, y: 20 });
  expect(moved.value).toBe(98);
  expect(moved.note).toBe(d.note);
  expect(distance(moved.a, moved.b)).toBe(100);
  expect(d.a).toEqual({ x: 30, y: 40 });
  expect(translateDimensionNote(d, 50000, 0)).toBe(d);
  expect(translateDimensionNote(d, NaN, 0)).toBe(d);
});

describe("point notes, persistent dimensions and exports", () => {
  it("stores a note at one point without requiring a second point", () => {
    const p = rectangle(),
      before = structuredClone(p.walls),
      n = addPointNote(p, { x: 123.5, y: 75 });
    n.text = "ここに棚を置く・高さ85 cm";
    expect(n.x).toBe(123.5);
    expect(n.y).toBe(75);
    expect(p.walls).toEqual(before);
    expect(parseProject(JSON.stringify(p))).toEqual(p);
    const moved = translatePointNote(n, 10, 20);
    expect(moved.x).toBe(133.5);
    expect(moved.text).toBe(n.text);
    expect(translatePointNote(n, 50000, 0)).toBe(n);
  });
  it("upgrades version 3 while preserving previous dimension notes", () => {
    const p = rectangle();
    addDimensionNote(p, { x: 0, y: 0 }, { x: 100, y: 0 }).note = "以前の寸法";
    const legacy = { ...p, formatVersion: 3, notes: undefined };
    const restored = parseProject(JSON.stringify(legacy));
    expect(restored.formatVersion).toBe(4);
    expect(restored.notes).toEqual([]);
    expect(restored.dimensions).toEqual(p.dimensions);
    expect(restored.walls).toEqual(p.walls);
  });
  it("rejects malformed point notes without treating them as geometry", () => {
    const p = rectangle();
    addPointNote(p, { x: 20, y: 40 });
    for (const patch of [
      { x: null },
      { text: 42 },
      { text: "x".repeat(201) },
      { id: p.walls[0].id },
    ]) {
      const q = structuredClone(p);
      Object.assign(q.notes[0], patch);
      expect(() => parseProject(JSON.stringify(q))).toThrow();
    }
    expect(() =>
      parseProject(JSON.stringify({ ...p, notes: undefined })),
    ).toThrow();
    expect(() =>
      parseProject(JSON.stringify({ ...p, dimensions: undefined })),
    ).toThrow();
    expect(() => addPointNote(p, { x: Infinity, y: 0 })).toThrow();
  });
  it("retains window dimension lanes and includes their outer labels in exports", () => {
    const p = rectangle();
    placeFixture(p, "window", { x: 80, y: 300 });
    placeFixture(p, "window", { x: 300, y: 300 });
    const entries = windowDimensionEntries(p);
    expect(entries).toHaveLength(2);
    expect(entries[0].offset).not.toBe(entries[1].offset);
    expect(windowDimensionEntries(p)).toEqual(entries);
    const b = annotationBounds(p, [], entries);
    for (const e of entries) {
      const y = e.placement.start.y + e.placement.ux * (e.offset + 50);
      expect(y).toBeLessThanOrEqual(b.y + b.height);
    }
  });
  it("bounds raster export memory and preserves the plan aspect ratio", () => {
    for (const [w, h] of [
      [1000, 700],
      [1, 100000],
      [100000, 1],
      [10000, 10000],
      [350, 900],
    ]) {
      const s = rasterSize(w, h);
      expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(3000);
      expect(s.width * s.height).toBeLessThanOrEqual(4000000);
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
    }
    expect(() => rasterSize(0, 100)).toThrow();
    expect(() => rasterSize(NaN, 100)).toThrow();
    const s = rasterSize(900, 600);
    expect(s.width / s.height).toBeCloseTo(1.5, 2);
  });
  it("removes a door leaf without closing or moving its opening", () => {
    const p = rectangle(),
      door = placeFixture(p, "sliding", { x: 200, y: 0 }),
      original = structuredClone(door),
      walls = structuredClone(p.walls);
    removeDoorLeaf(p, door.id);
    expect(door.kind).toBe("opening");
    expect(door.width).toBe(original.width);
    expect(door.height).toBe(original.height);
    expect(door.x).toBe(original.x);
    expect(door.rotation).toBe(original.rotation);
    expect(p.walls).toEqual(walls);
    expect(parseProject(JSON.stringify(p))).toEqual(p);
    moveItem(p, door, { x: 250, y: 5 });
    expect(door.y).toBe(0);
    resizeWall(p, p.walls[0].id, 500);
    expect(door.x).toBeCloseTo(312.5);
    expect(door.kind).toBe("opening");
  });
});

describe("precise furniture movement", () => {
  it("preserves measured offsets and the locked coordinate during snapped dragging", () => {
    expect(
      furniturePosition({ x: 12.5, y: 36.7 }, { x: 4.3, y: 19.2 }, 1, "x"),
    ).toEqual({ x: 16.5, y: 36.7 });
    expect(
      furniturePosition({ x: 12.5, y: 36.7 }, { x: 4.3, y: -19.2 }, 10, "y"),
    ).toEqual({ x: 12.5, y: 16.7 });
  });
  it("supports millimetre adjustments and unsnapped movement without cumulative decimal noise", () => {
    let point = { x: 0, y: 0 };
    for (let i = 0; i < 100; i++)
      point = furniturePosition(point, { x: 0.1, y: 0 }, 0, "free");
    expect(point).toEqual({ x: 10, y: 0 });
    expect(
      furniturePosition(point, { x: 0.24, y: -0.36 }, 0.1, "free"),
    ).toEqual({ x: 10.2, y: -0.4 });
    expect(
      furniturePosition(point, { x: 0.234, y: -0.356 }, 0, "free"),
    ).toEqual({ x: 10.234, y: -0.356 });
  });
  it("rejects invalid displacement and movement beyond the saved coordinate range", () => {
    const point = { x: 49999, y: 0 };
    expect(furniturePosition(point, { x: 10, y: 0 }, 0, "free")).toBe(point);
    expect(furniturePosition(point, { x: NaN, y: 0 }, 1, "free")).toBe(point);
  });
});
