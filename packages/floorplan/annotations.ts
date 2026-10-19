import { wallInsets, wallInteriorLength, openingPlacement } from "./geometry";
import {
  bounds,
  distance,
  same,
  type Room,
  type Wall,
  type Project,
  type Item,
} from "./model";
export function furnitureCallouts(p: Project) {
  const items = p.items.filter((i) => !i.kind);
  if (!items.length) return [];
  const points = p.walls.length
    ? p.walls.flatMap((w) => [w.a, w.b])
    : items.flatMap((i) => [
        { x: i.x - i.width / 2, y: i.y - i.depth / 2 },
        { x: i.x + i.width / 2, y: i.y + i.depth / 2 },
      ]);
  const minX = Math.min(...points.map((v) => v.x)),
    maxX = Math.max(...points.map((v) => v.x)),
    minY = Math.min(...points.map((v) => v.y)),
    mid = (minX + maxX) / 2;
  return (["left", "right"] as const).flatMap((side) => {
    let previous = minY - 34;
    return items
      .filter((i) => (i.x < mid ? "left" : "right") === side)
      .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id))
      .map((item) => {
        const text =
          item.name.length > 24 ? item.name.slice(0, 24) + "…" : item.name;
        const width = Math.max(
          100,
          Array.from(text).reduce(
            (n, c) => n + (c.charCodeAt(0) > 127 ? 13 : 7),
            24,
          ),
        );
        const y = Math.max(item.y, minY + 16, previous + 34);
        previous = y;
        return {
          id: item.id,
          name: item.name,
          text,
          side,
          width,
          x: side === "left" ? minX - 70 - width : maxX + 70,
          y,
          anchor: { x: item.x, y: item.y },
          elbow: side === "left" ? minX - 24 : maxX + 24,
        };
      });
  });
}
export function annotationBounds(
  p: Project,
  callouts: ReturnType<typeof furnitureCallouts>,
  windows: ReturnType<typeof windowDimensionEntries> = [],
  objects: ReturnType<typeof itemDimensionEntries> = [],
) {
  const b = bounds(p);
  if (!callouts.length && !windows.length && !objects.length) return b;
  const windowPoints = windows.flatMap((w) => {
    const m = w.placement,
      offset = w.offset + 50;
    return [m.start, m.end].map((p) => ({
      x: p.x - m.uy * offset,
      y: p.y + m.ux * offset,
    }));
  });
  const objectPoints = objects.flatMap((entry) => entry.points);
  const minX = Math.min(
      b.x,
      ...callouts.map((c) => c.x - 20),
      ...windowPoints.map((p) => p.x - 30),
      ...objectPoints.map((p) => p.x - 30),
    ),
    minY = Math.min(
      b.y,
      ...callouts.map((c) => c.y - 36),
      ...windowPoints.map((p) => p.y - 30),
      ...objectPoints.map((p) => p.y - 30),
    ),
    maxX = Math.max(
      b.x + b.width,
      ...callouts.map((c) => c.x + c.width + 20),
      ...windowPoints.map((p) => p.x + 30),
      ...objectPoints.map((p) => p.x + 30),
    ),
    maxY = Math.max(
      b.y + b.height,
      ...callouts.map((c) => c.y + 36),
      ...windowPoints.map((p) => p.y + 30),
      ...objectPoints.map((p) => p.y + 30),
    );
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function windowDimensionEntries(p: Project) {
  return openingDimensionEntries(p, (item) => item.kind === "window");
}
export function openingDimensionEntries(
  p: Project,
  visible: (item: Item) => boolean = () => true,
) {
  const lanes = new Map<string, number>();
  return p.items
    .filter((i) => !i.dimensionHidden && visible(i))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((item) => {
      const placement = openingPlacement(p, item);
      if (!placement) return [];
      const lane = lanes.get(placement.wall.id) ?? 0;
      lanes.set(placement.wall.id, lane + 1);
      return [{ item, placement, offset: 58 + lane * 52 }];
    });
}
export function itemDimensionEntries(
  p: Project,
  visible: (item: Item) => boolean,
) {
  return p.items
    .filter((item) => visible(item) && !openingPlacement(p, item))
    .map((item) => {
      const angle = (item.rotation * Math.PI) / 180;
      const local = [
        { x: Math.min(-item.width / 2 - 25, -90), y: -item.depth / 2 - 40 },
        { x: item.width / 2 + 200, y: -item.depth / 2 - 40 },
        { x: item.width / 2 + 200, y: item.depth / 2 + 40 },
        { x: Math.min(-item.width / 2 - 25, -90), y: item.depth / 2 + 40 },
      ];
      return {
        item,
        points: local.map(({ x, y }) => ({
          x: item.x + x * Math.cos(angle) - y * Math.sin(angle),
          y: item.y + x * Math.sin(angle) + y * Math.cos(angle),
        })),
      };
    });
}
export function rasterSize(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error("画像の範囲が不正です。");
  const scale = Math.min(
    3000 / Math.max(width, height),
    Math.sqrt(4000000 / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

export function wallDimensionLayout(
  p: Project,
  wall: Wall,
  roomList: Room[] = [],
) {
  const length = distance(wall.a, wall.b),
    ux = (wall.b.x - wall.a.x) / length,
    uy = (wall.b.y - wall.a.y) / length;
  const normal = { x: uy, y: -ux },
    inset = wallInsets(p, wall);
  const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const small = roomList
    .filter(
      (r) =>
        r.area <= 6 &&
        r.points.some((a, i) => {
          const b = r.points[(i + 1) % r.points.length];
          return (
            (same(a, wall.a) && same(b, wall.b)) ||
            (same(a, wall.b) && same(b, wall.a))
          );
        }),
    )
    .sort((a, b) => a.area - b.area)[0];
  const sign =
    small &&
    (small.center.x - mid.x) * normal.x + (small.center.y - mid.y) * normal.y <
      0
      ? -1
      : 1;
  const offset =
    wall.dimensionOffset ?? sign * Math.max(26, wall.thickness / 2 + 14);
  return {
    normal,
    offset,
    a: {
      x: wall.a.x + ux * inset.start + normal.x * offset,
      y: wall.a.y + uy * inset.start + normal.y * offset,
    },
    b: {
      x: wall.b.x - ux * inset.end + normal.x * offset,
      y: wall.b.y - uy * inset.end + normal.y * offset,
    },
    label: { x: mid.x + normal.x * offset, y: mid.y + normal.y * offset - 5 },
    value: Math.round(wallInteriorLength(p, wall) * 10) / 10,
  };
}
