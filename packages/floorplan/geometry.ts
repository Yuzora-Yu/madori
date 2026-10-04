import {
  distance,
  inside,
  rooms,
  same,
  type Furniture,
  type Item,
  type Point,
  type Project,
  type Room,
  type Wall,
} from "./model";

// SVG x/y and Three.js x/z use the same plan coordinates.
export function doorPose(item: Item) {
  const handed = item.doorHinge === "right" ? -1 : 1;
  const swing = item.doorSwing === "negative" ? -1 : 1;
  const opening = ((item.doorAngle ?? 90) * Math.PI) / 180;
  const angle = (handed === 1 ? 0 : Math.PI) + handed * swing * opening;
  const hinge = { x: (-handed * item.width) / 2, y: 0 };
  const closed = { x: (handed * item.width) / 2, y: 0 };
  const tip = {
    x: hinge.x + item.width * Math.cos(angle),
    y: item.width * Math.sin(angle),
  };
  return {
    hinge,
    closed,
    tip,
    center: { x: (hinge.x + tip.x) / 2, y: tip.y / 2 },
    angle,
    sweep: handed * swing > 0 ? 1 : 0,
  };
}
export function shelfBoards(item: Furniture | Item) {
  const levels = item.shelfLevels ?? 4;
  const thickness = Math.min(
    2,
    item.height / (levels + 1) / 3,
    item.width / 10,
    item.depth / 10,
  );
  return {
    levels,
    thickness,
    heights: Array.from(
      { length: levels + 1 },
      (_, i) => thickness / 2 + ((item.height - thickness) * i) / levels,
    ),
  };
}
function edgeWall(p: Pick<Project, "walls">, a: Point, b: Point) {
  return p.walls.find(
    (w) => (same(w.a, a) && same(w.b, b)) || (same(w.b, a) && same(w.a, b)),
  );
}
export function wallInsets(p: Pick<Project, "walls">, w: Wall) {
  const length = distance(w.a, w.b),
    dx = (w.b.x - w.a.x) / length,
    dy = (w.b.y - w.a.y) / length;
  const at = (point: Point) =>
    Math.max(
      0,
      ...p.walls
        .filter(
          (other) =>
            other.id !== w.id && (same(other.a, point) || same(other.b, point)),
        )
        .map((other) => {
          const len = distance(other.a, other.b),
            cross = Math.abs(
              (dx * (other.b.y - other.a.y)) / len -
                (dy * (other.b.x - other.a.x)) / len,
            );
          return cross > 0.05 ? other.thickness / (2 * cross) : 0;
        }),
    );
  return { start: at(w.a), end: at(w.b) };
}
export function wallInteriorLength(p: Pick<Project, "walls">, w: Wall) {
  const inset = wallInsets(p, w);
  return Math.max(0, distance(w.a, w.b) - inset.start - inset.end);
}
export function interiorRoom(p: Pick<Project, "walls">, room: Room) {
  const minX = Math.min(...room.points.map((v) => v.x)),
    maxX = Math.max(...room.points.map((v) => v.x)),
    minY = Math.min(...room.points.map((v) => v.y)),
    maxY = Math.max(...room.points.map((v) => v.y));
  const edges = room.points.map((a, i) => {
    const b = room.points[(i + 1) % room.points.length],
      len = distance(a, b),
      offset = (edgeWall(p, a, b)?.thickness ?? 12) / 2;
    return {
      a,
      b,
      x: a.x - ((b.y - a.y) / len) * offset,
      y: a.y + ((b.x - a.x) / len) * offset,
      dx: b.x - a.x,
      dy: b.y - a.y,
      offset,
    };
  });
  const rectangular =
    Math.abs(room.area * 10000 - (maxX - minX) * (maxY - minY)) < 1 &&
    edges.every((e) => Math.abs(e.dx) < 0.01 || Math.abs(e.dy) < 0.01);
  const points = edges.map((e, i) => {
    const prev = edges[(i - 1 + edges.length) % edges.length],
      cross = prev.dx * e.dy - prev.dy * e.dx;
    if (Math.abs(cross) < 0.001) return { x: e.x, y: e.y };
    const t = ((e.x - prev.x) * e.dy - (e.y - prev.y) * e.dx) / cross;
    return { x: prev.x + t * prev.dx, y: prev.y + t * prev.dy };
  });
  const insetX0 = Math.max(
    0,
    ...edges
      .filter(
        (e) => Math.abs(e.a.x - minX) < 0.01 && Math.abs(e.b.x - minX) < 0.01,
      )
      .map((e) => e.offset),
  );
  const insetX1 = Math.max(
    0,
    ...edges
      .filter(
        (e) => Math.abs(e.a.x - maxX) < 0.01 && Math.abs(e.b.x - maxX) < 0.01,
      )
      .map((e) => e.offset),
  );
  const insetY0 = Math.max(
    0,
    ...edges
      .filter(
        (e) => Math.abs(e.a.y - minY) < 0.01 && Math.abs(e.b.y - minY) < 0.01,
      )
      .map((e) => e.offset),
  );
  const insetY1 = Math.max(
    0,
    ...edges
      .filter(
        (e) => Math.abs(e.a.y - maxY) < 0.01 && Math.abs(e.b.y - maxY) < 0.01,
      )
      .map((e) => e.offset),
  );
  const width = Math.max(0, maxX - minX - insetX0 - insetX1),
    depth = Math.max(0, maxY - minY - insetY0 - insetY1);
  const signed =
    points.reduce((s, a, i) => {
      const b = points[(i + 1) % points.length];
      return s + a.x * b.y - b.x * a.y;
    }, 0) / 2;
  const area = rectangular
    ? (width * depth) / 10000
    : Math.max(0, signed) / 10000;
  return {
    rectangular,
    points,
    area,
    width,
    depth,
    minX,
    maxX,
    minY,
    maxY,
    insetX0,
    insetX1,
    insetY0,
    insetY1,
  };
}
export function resizeRoomInterior(
  p: Project,
  room: Room,
  axis: "x" | "y",
  value: number,
) {
  const metrics = interiorRoom(p, room);
  if (
    !metrics.rectangular ||
    !Number.isFinite(value) ||
    value < 10 ||
    value > 20000
  )
    throw new Error("内寸は四角い部屋で10〜20,000 cmを指定してください。");
  const maximum = axis === "x" ? metrics.maxX : metrics.maxY,
    current = axis === "x" ? metrics.width : metrics.depth,
    delta = value - current;
  const moved = room.points
    .filter((v) => Math.abs(v[axis] - maximum) < 0.01)
    .map((v) => ({ ...v }));
  // Move a continuous straight wall together instead of bending the next segment.
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const wall of p.walls)
      if (
        Math.abs(wall.a[axis] - maximum) < 0.01 &&
        Math.abs(wall.b[axis] - maximum) < 0.01 &&
        moved.some((v) => same(v, wall.a) || same(v, wall.b))
      )
        for (const point of [wall.a, wall.b])
          if (!moved.some((v) => same(v, point))) {
            moved.push({ ...point });
            expanded = true;
          }
  }
  const candidate = structuredClone(p),
    beforeRooms = rooms(p);
  const attached = candidate.items
    .filter(
      (i) => i.kind && ["door", "window", "sliding", "outlet"].includes(i.kind),
    )
    .map((item) => {
      const hit = p.walls
        .map((w) => {
          const dx = w.b.x - w.a.x,
            dy = w.b.y - w.a.y,
            len2 = dx * dx + dy * dy,
            t = Math.max(
              0,
              Math.min(
                1,
                ((item.x - w.a.x) * dx + (item.y - w.a.y) * dy) / len2,
              ),
            );
          return {
            w,
            t,
            dist: Math.hypot(item.x - w.a.x - t * dx, item.y - w.a.y - t * dy),
          };
        })
        .sort((a, b) => a.dist - b.dist)[0];
      return hit && hit.dist < hit.w.thickness / 2 + 2
        ? {
            item,
            hit,
            angle:
              item.rotation -
              (Math.atan2(hit.w.b.y - hit.w.a.y, hit.w.b.x - hit.w.a.x) * 180) /
                Math.PI,
          }
        : null;
    })
    .filter((v) => v !== null);
  for (const w of candidate.walls)
    for (const key of ["a", "b"] as const)
      if (moved.some((v) => same(v, w[key])))
        w[key] = { ...w[key], [axis]: w[key][axis] + delta };
  const afterRooms = rooms(candidate);
  if (
    candidate.walls.some(
      (w, i) =>
        distance(w.a, w.b) < 1 ||
        (w.b.x - w.a.x) * (p.walls[i].b.x - p.walls[i].a.x) +
          (w.b.y - w.a.y) * (p.walls[i].b.y - p.walls[i].a.y) <=
          0,
    ) ||
    afterRooms.length !== beforeRooms.length ||
    afterRooms.some((r) => r.area <= 0 || interiorRoom(candidate, r).area <= 0)
  )
    throw new Error("隣の部屋がつぶれる寸法です。小さい値で調整してください。");
  for (const a of attached) {
    const w = candidate.walls.find((w) => w.id === a.hit.w.id)!;
    a.item.x = w.a.x + (w.b.x - w.a.x) * a.hit.t;
    a.item.y = w.a.y + (w.b.y - w.a.y) * a.hit.t;
    a.item.rotation =
      (Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180) / Math.PI + a.angle;
  }
  candidate.labels.forEach((label) => {
    const index = beforeRooms.findIndex((r) => inside(label, r.points));
    if (index >= 0) Object.assign(label, afterRooms[index].center);
  });
  p.walls = candidate.walls;
  p.items = candidate.items;
  p.labels = candidate.labels;
}
