import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  dimensionBoundsProject,
  dimensionCategories,
  dimensionVisible,
  itemDimensionVisible,
  readDimensionDisplay,
} from "../packages/floorplan/dimension-display";
import {
  annotationBounds,
  openingDimensionEntries,
  itemDimensionEntries,
} from "../packages/floorplan/annotations";
import {
  addPointNote,
  addWall,
  emptyProject,
  parseProject,
  placeFixture,
} from "../packages/floorplan/model";
import OpeningDimensions from "../app/floorplan/OpeningDimensions";

function sample() {
  const p = emptyProject();
  for (const [x, y, xx, yy] of [
    [0, 0, 600, 0],
    [600, 0, 600, 400],
    [600, 400, 0, 400],
    [0, 400, 0, 0],
  ])
    addWall(p, { x, y }, { x: xx, y: yy });
  placeFixture(p, "window", { x: 120, y: 0 });
  placeFixture(p, "sliding", { x: 350, y: 0 });
  return p;
}
describe("dimension display", () => {
  it("retains the old window preference, validates optional settings, and remembers category choices under a master switch", () => {
    expect(readDimensionDisplay({ showWindowDimensions: false }).windows).toBe(
      false,
    );
    const settings = readDimensionDisplay({
      dimensionDisplay: {
        enabled: false,
        windows: false,
        walls: "false",
        furniture: true,
      },
    });
    expect(settings.walls).toBe(true);
    expect(settings.furniture).toBe(true);
    for (const [key] of dimensionCategories)
      expect(dimensionVisible(settings, key)).toBe(false);
    const restored = readDimensionDisplay(
      JSON.parse(JSON.stringify({ dimensionDisplay: settings })),
    );
    restored.enabled = true;
    expect(dimensionVisible(restored, "windows")).toBe(false);
    expect(dimensionVisible(restored, "furniture")).toBe(true);
    for (const bad of [null, [], "bad", { dimensionDisplay: null }])
      expect(readDimensionDisplay(bad).enabled).toBe(true);
  });
  it("dimensions sliding openings and windows in separate lanes, with inner-wall gaps and individual hiding", () => {
    const p = sample(),
      settings = readDimensionDisplay({});
    const entries = () =>
      openingDimensionEntries(p, (i) => itemDimensionVisible(settings, i));
    expect(entries()).toHaveLength(2);
    expect(new Set(entries().map((e) => e.offset)).size).toBe(2);
    const sliding = p.items[1],
      entry = entries().find((e) => e.item.id === sliding.id)!;
    expect(
      entry.placement.gapA + entry.placement.gapB + sliding.width,
    ).toBeCloseTo(588);
    const xml = renderToStaticMarkup(
      createElement(OpeningDimensions, {
        item: sliding,
        placement: entry.placement,
      }),
    );
    expect(xml).toContain("開口幅 160 cm");
    sliding.dimensionHidden = true;
    expect(entries().map((e) => e.item.id)).toEqual([p.items[0].id]);
    const restored = parseProject(JSON.stringify(p));
    expect(restored.items[1].dimensionHidden).toBe(true);
    expect(restored.items[1].width).toBe(160);
    for (const bad of ["true", 1, null]) {
      const invalid = structuredClone(p);
      Object.assign(invalid.items[1], { dimensionHidden: bad });
      expect(() => parseProject(JSON.stringify(invalid))).toThrow();
    }
  });
  it("keeps hidden extents out of exports without editing geometry or losing note positions", () => {
    const p = sample(),
      settings = readDimensionDisplay({});
    p.walls[0].dimensionOffset = 1500;
    addPointNote(p, { x: 3000, y: 3000 });
    const before = structuredClone(p);
    const visible = annotationBounds(dimensionBoundsProject(p, settings), []);
    settings.enabled = false;
    const hidden = annotationBounds(dimensionBoundsProject(p, settings), []);
    expect(hidden.width).toBeLessThan(visible.width);
    expect(hidden.height).toBeLessThan(visible.height);
    expect(p).toEqual(before);
  });
  it("dimensions independent fixtures and rotated objects without duplicating attached opening dimensions", () => {
    const p = sample(),
      settings = readDimensionDisplay({});
    const cabinet = placeFixture(p, "cabinetDoor", { x: 550, y: 350 });
    cabinet.rotation = 135;
    expect(
      itemDimensionEntries(p, (i) => itemDimensionVisible(settings, i)),
    ).toHaveLength(0);
    settings.fixtures = true;
    const objects = itemDimensionEntries(p, (i) =>
      itemDimensionVisible(settings, i),
    );
    expect(objects.map((e) => e.item.id)).toEqual([cabinet.id]);
    const b = annotationBounds(p, [], [], objects);
    for (const point of objects[0].points) {
      expect(point.x).toBeGreaterThanOrEqual(b.x);
      expect(point.x).toBeLessThanOrEqual(b.x + b.width);
      expect(point.y).toBeGreaterThanOrEqual(b.y);
      expect(point.y).toBeLessThanOrEqual(b.y + b.height);
    }
  });
});
