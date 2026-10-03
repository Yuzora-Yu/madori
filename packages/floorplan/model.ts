export interface Point {
  x: number;
  y: number;
}
export interface Wall {
  id: string;
  a: Point;
  b: Point;
  thickness: number;
  height: number;
}
export type Shape =
  "sofa" | "bed" | "table" | "storage" | "appliance" | "plant" | "generic";
export type FixtureKind =
  "door" | "sliding" | "window" | "bath" | "toilet" | "outlet";
export interface Furniture {
  id: string;
  name: string;
  category: string;
  width: number;
  depth: number;
  height: number;
  color: string;
  shape: Shape;
}
export interface Item {
  id: string;
  furnitureId?: string;
  kind?: FixtureKind;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  color: string;
  shape: Shape;
}
export interface RoomLabel {
  x: number;
  y: number;
  name: string;
  color: string;
}
export interface Project {
  formatVersion: 1;
  name: string;
  nextId: number;
  walls: Wall[];
  furniture: Furniture[];
  items: Item[];
  labels: RoomLabel[];
}
export interface Room {
  points: Point[];
  area: number;
  center: Point;
}
export const STORAGE_KEY = "madori.project.v1";
export const distance = (a: Point, b: Point) =>
  Math.hypot(b.x - a.x, b.y - a.y);
export const same = (a: Point, b: Point) => distance(a, b) < 0.1;
export const snap = (n: number, enabled: boolean) =>
  enabled ? Math.round(n / 10) * 10 : Math.round(n);
export function bounds(p: Project) {
  const points = [
    ...p.walls.flatMap((w) => [w.a, w.b]),
    ...p.items.flatMap((i) => [
      { x: i.x - i.width, y: i.y - i.depth },
      { x: i.x + i.width, y: i.y + i.depth },
    ]),
  ];
  if (!points.length) return { x: -50, y: -50, width: 1000, height: 800 };
  const x = Math.min(...points.map((v) => v.x)),
    y = Math.min(...points.map((v) => v.y));
  return {
    x: x - 90,
    y: y - 90,
    width: Math.max(400, Math.max(...points.map((v) => v.x)) - x + 180),
    height: Math.max(350, Math.max(...points.map((v) => v.y)) - y + 180),
  };
}
export function projectOnWall(point: Point, wall: Wall) {
  const dx = wall.b.x - wall.a.x,
    dy = wall.b.y - wall.a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - wall.a.x) * dx + (point.y - wall.a.y) * dy) /
        (dx * dx + dy * dy || 1),
    ),
  );
  const p = { x: wall.a.x + t * dx, y: wall.a.y + t * dy };
  return { ...p, t, distance: distance(point, p) };
}
export function attachPoint(p: Project, point: Point, tolerance = 18): Point {
  const endpoint = p.walls
    .flatMap((w) => [w.a, w.b])
    .find((v) => distance(v, point) < tolerance);
  if (endpoint) return { ...endpoint };
  const nearest = p.walls
    .map((w) => ({ wall: w, hit: projectOnWall(point, w) }))
    .sort((a, b) => a.hit.distance - b.hit.distance)[0];
  if (
    nearest &&
    nearest.hit.distance < tolerance &&
    nearest.hit.t > 0.01 &&
    nearest.hit.t < 0.99
  ) {
    const pos = { x: nearest.hit.x, y: nearest.hit.y };
    p.walls.push({ ...nearest.wall, id: `w${p.nextId++}`, a: pos });
    nearest.wall.b = pos;
    return pos;
  }
  return point;
}
export function addWall(p: Project, start: Point, end: Point) {
  if (distance(start, end) < 10) return;
  const a = attachPoint(p, start),
    b = attachPoint(p, end);
  if (
    same(a, b) ||
    p.walls.some(
      (w) => (same(w.a, a) && same(w.b, b)) || (same(w.a, b) && same(w.b, a)),
    )
  )
    return;
  // Split both new and existing segments at crossings so room detection remains topological.
  const cuts: { t: number; p: Point }[] = [
    { t: 0, p: a },
    { t: 1, p: b },
  ];
  for (const wall of [...p.walls]) {
    const r = { x: b.x - a.x, y: b.y - a.y },
      s = { x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y };
    const cross = r.x * s.y - r.y * s.x;
    if (Math.abs(cross) < 0.001) continue;
    const q = { x: wall.a.x - a.x, y: wall.a.y - a.y };
    const t = (q.x * s.y - q.y * s.x) / cross,
      u = (q.x * r.y - q.y * r.x) / cross;
    if (t > 0.0001 && t < 0.9999 && u >= 0 && u <= 1) {
      const pos = { x: a.x + t * r.x, y: a.y + t * r.y };
      cuts.push({ t, p: pos });
      if (u > 0.0001 && u < 0.9999) {
        p.walls.push({ ...wall, id: `w${p.nextId++}`, a: pos });
        wall.b = pos;
      }
    }
  }
  cuts.sort((a, b) => a.t - b.t);
  for (let i = 1; i < cuts.length; i++)
    if (!same(cuts[i - 1].p, cuts[i].p))
      p.walls.push({
        id: `w${p.nextId++}`,
        a: cuts[i - 1].p,
        b: cuts[i].p,
        thickness: 12,
        height: 250,
      });
}
export function resizeWall(p: Project, id: string, length: number) {
  const w = p.walls.find((w) => w.id === id);
  if (!w || length < 10 || length > 20000) return;
  const attached = p.items
    .filter(
      (i) => i.kind && ["door", "sliding", "window", "outlet"].includes(i.kind),
    )
    .flatMap((item) => {
      const near = p.walls
        .map((wall) => ({ wall, hit: projectOnWall(item, wall) }))
        .sort((a, b) => a.hit.distance - b.hit.distance)[0];
      return near && near.hit.distance < near.wall.thickness / 2 + 2
        ? [{ item, wallId: near.wall.id, t: near.hit.t }]
        : [];
    });
  const old = { ...w.b },
    ratio = length / distance(w.a, w.b);
  const b = {
    x: Math.round(w.a.x + (w.b.x - w.a.x) * ratio),
    y: Math.round(w.a.y + (w.b.y - w.a.y) * ratio),
  };
  for (const other of p.walls) {
    if (same(other.a, old)) other.a = { ...b };
    if (same(other.b, old)) other.b = { ...b };
  }
  for (const a of attached) {
    const wall = p.walls.find((w) => w.id === a.wallId)!;
    a.item.x = wall.a.x + (wall.b.x - wall.a.x) * a.t;
    a.item.y = wall.a.y + (wall.b.y - wall.a.y) * a.t;
    a.item.rotation =
      (Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) * 180) / Math.PI;
  }
}
export function rooms(p: Pick<Project, "walls">): Room[] {
  const key = (v: Point) => `${v.x.toFixed(2)},${v.y.toFixed(2)}`;
  const vertices = new Map<string, { p: Point; neighbors: string[] }>();
  for (const w of p.walls) {
    for (const [a, b] of [
      [w.a, w.b],
      [w.b, w.a],
    ]) {
      if (!vertices.has(key(a))) vertices.set(key(a), { p: a, neighbors: [] });
      const v = vertices.get(key(a))!;
      if (!v.neighbors.includes(key(b))) v.neighbors.push(key(b));
    }
  }
  for (const v of vertices.values())
    v.neighbors.sort((a, b) => {
      const pa = vertices.get(a)!.p,
        pb = vertices.get(b)!.p;
      return (
        Math.atan2(pa.y - v.p.y, pa.x - v.p.x) -
        Math.atan2(pb.y - v.p.y, pb.x - v.p.x)
      );
    });
  const visited = new Set<string>(),
    result: Room[] = [];
  for (const [start, v] of vertices)
    for (const next of v.neighbors) {
      let a = start,
        b = next;
      const polygon: Point[] = [];
      for (let i = 0; i <= p.walls.length * 2; i++) {
        if (visited.has(`${a}|${b}`)) break;
        visited.add(`${a}|${b}`);
        polygon.push(vertices.get(a)!.p);
        const node = vertices.get(b)!,
          index = node.neighbors.indexOf(a);
        const c =
          node.neighbors[
            (index - 1 + node.neighbors.length) % node.neighbors.length
          ];
        a = b;
        b = c;
        if (a === start && b === next) {
          const sum = polygon.reduce((s, pt, j) => {
            const q = polygon[(j + 1) % polygon.length];
            return s + pt.x * q.y - q.x * pt.y;
          }, 0);
          if (sum > 200) {
            let cx = 0,
              cy = 0;
            polygon.forEach((pt, j) => {
              const q = polygon[(j + 1) % polygon.length],
                cross = pt.x * q.y - q.x * pt.y;
              cx += (pt.x + q.x) * cross;
              cy += (pt.y + q.y) * cross;
            });
            result.push({
              points: polygon,
              area: sum / 20000,
              center: { x: cx / (3 * sum), y: cy / (3 * sum) },
            });
          }
          break;
        }
      }
    }
  return result;
}
export function inside(point: Point, polygon: Point[]) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
export const fixtureDefaults: Record<
  FixtureKind,
  { name: string; width: number; depth: number; height: number; color: string }
> = {
  door: { name: "ドア", width: 80, depth: 12, height: 210, color: "#bda282" },
  sliding: {
    name: "引き戸",
    width: 160,
    depth: 12,
    height: 210,
    color: "#bda282",
  },
  window: { name: "窓", width: 150, depth: 12, height: 110, color: "#9dbfc5" },
  bath: { name: "浴槽", width: 80, depth: 160, height: 60, color: "#a7c8cb" },
  toilet: {
    name: "トイレ",
    width: 45,
    depth: 70,
    height: 75,
    color: "#d6e1df",
  },
  outlet: {
    name: "コンセント",
    width: 12,
    depth: 8,
    height: 30,
    color: "#f3e4b8",
  },
};
export function placeFixture(
  p: Project,
  kind: FixtureKind,
  point: Point,
): Item {
  const item: Item = {
    ...fixtureDefaults[kind],
    ...point,
    id: `i${p.nextId++}`,
    kind,
    shape: "generic",
    rotation: 0,
  };
  moveItem(p, item, point);
  p.items.push(item);
  return item;
}
export function moveItem(p: Project, item: Item, point: Point) {
  item.x = point.x;
  item.y = point.y;
  if (
    item.kind &&
    ["door", "sliding", "window", "outlet"].includes(item.kind)
  ) {
    const near = p.walls
      .map((w) => ({ w, hit: projectOnWall(point, w) }))
      .sort((a, b) => a.hit.distance - b.hit.distance)[0];
    if (near && near.hit.distance < 50) {
      item.x = near.hit.x;
      item.y = near.hit.y;
      item.rotation =
        (Math.atan2(near.w.b.y - near.w.a.y, near.w.b.x - near.w.a.x) * 180) /
        Math.PI;
    }
  }
}
export function emptyProject(): Project {
  return {
    formatVersion: 1,
    name: "新しい間取り",
    nextId: 1,
    walls: [],
    furniture: defaultFurniture(),
    items: [],
    labels: [],
  };
}
function defaultFurniture(): Furniture[] {
  return [
    {
      id: "f-sofa",
      name: "2人掛けソファ",
      category: "ソファ",
      width: 180,
      depth: 85,
      height: 80,
      color: "#84a792",
      shape: "sofa",
    },
    {
      id: "f-table",
      name: "ダイニングテーブル",
      category: "テーブル",
      width: 140,
      depth: 80,
      height: 72,
      color: "#cbb594",
      shape: "table",
    },
    {
      id: "f-bed",
      name: "ダブルベッド",
      category: "ベッド",
      width: 140,
      depth: 200,
      height: 50,
      color: "#c0b8ab",
      shape: "bed",
    },
    {
      id: "f-storage",
      name: "キャビネット",
      category: "収納",
      width: 120,
      depth: 40,
      height: 85,
      color: "#b59b79",
      shape: "storage",
    },
    {
      id: "f-fridge",
      name: "冷蔵庫",
      category: "家電",
      width: 65,
      depth: 65,
      height: 175,
      color: "#b7c0c4",
      shape: "appliance",
    },
    {
      id: "f-plant",
      name: "観葉植物",
      category: "その他",
      width: 45,
      depth: 45,
      height: 120,
      color: "#6f9471",
      shape: "plant",
    },
  ];
}
export function demoProject(): Project {
  const p = emptyProject();
  p.name = "わたしの、心地よい部屋";
  const segments = [
    [0, 0, 900, 0],
    [900, 0, 900, 650],
    [900, 650, 0, 650],
    [0, 650, 0, 0],
    [600, 0, 600, 650],
    [600, 400, 900, 400],
    [600, 520, 900, 520],
    [750, 400, 750, 520],
  ];
  for (const [x, y, xx, yy] of segments) addWall(p, { x, y }, { x: xx, y: yy });
  p.labels = [
    { x: 300, y: 300, name: "リビング・ダイニング", color: "#efeade" },
    { x: 750, y: 200, name: "ベッドルーム", color: "#e8eee7" },
    { x: 675, y: 460, name: "バスルーム", color: "#e6eef0" },
    { x: 825, y: 460, name: "トイレ", color: "#eef1ee" },
    { x: 750, y: 580, name: "玄関", color: "#ede8e1" },
  ];
  for (const [id, x, y, rotation] of [
    ["f-sofa", 125, 210, 270],
    ["f-table", 390, 330, 0],
    ["f-bed", 750, 180, 0],
    ["f-storage", 330, 35, 0],
    ["f-fridge", 555, 55, 0],
    ["f-plant", 60, 575, 0],
  ] as [string, number, number, number][]) {
    const f = p.furniture.find((f) => f.id === id)!;
    p.items.push({
      ...f,
      id: `i${p.nextId++}`,
      furnitureId: f.id,
      x,
      y,
      rotation,
    });
  }
  placeFixture(p, "window", { x: 270, y: 650 });
  placeFixture(p, "window", { x: 750, y: 0 });
  placeFixture(p, "door", { x: 600, y: 330 });
  placeFixture(p, "sliding", { x: 420, y: 0 });
  placeFixture(p, "bath", { x: 675, y: 460 }).rotation = 90;
  placeFixture(p, "toilet", { x: 825, y: 460 });
  placeFixture(p, "door", { x: 830, y: 650 });
  placeFixture(p, "outlet", { x: 0, y: 410 });
  return p;
}
export function parseProject(text: string): Project {
  const p = JSON.parse(text);
  if (!p || p.formatVersion !== 1)
    throw new Error(
      "対応していない保存形式です。元のファイルは変更されません。",
    );
  const finite = (v: unknown, min = -50000, max = 50000): v is number =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  const str = (v: unknown): v is string =>
    typeof v === "string" && v.length <= 200;
  const point = (v: Point) => v && finite(v.x) && finite(v.y);
  const dimensions = (v: Furniture | Item) =>
    finite(v.width, 1, 20000) &&
    finite(v.depth, 1, 20000) &&
    finite(v.height, 1, 20000);
  const appearance = (v: Furniture | Item) =>
    str(v.name) &&
    /^#[\da-f]{6}$/i.test(v.color) &&
    [
      "sofa",
      "bed",
      "table",
      "storage",
      "appliance",
      "plant",
      "generic",
    ].includes(v.shape);
  if (
    !str(p.name) ||
    !Number.isSafeInteger(p.nextId) ||
    p.nextId < 1 ||
    !Array.isArray(p.walls) ||
    !Array.isArray(p.items) ||
    !Array.isArray(p.furniture) ||
    !Array.isArray(p.labels) ||
    [p.walls, p.items, p.furniture, p.labels].some((a) => a.length > 2000)
  )
    throw new Error("間取りデータが不正です。");
  if (
    !p.walls.every(
      (w: Wall) =>
        w &&
        str(w.id) &&
        point(w.a) &&
        point(w.b) &&
        distance(w.a, w.b) > 0.1 &&
        finite(w.thickness, 1, 100) &&
        finite(w.height, 1, 2000),
    ) ||
    !p.furniture.every(
      (f: Furniture) =>
        f && str(f.id) && str(f.category) && dimensions(f) && appearance(f),
    ) ||
    !p.items.every(
      (i: Item) =>
        i &&
        str(i.id) &&
        point(i) &&
        dimensions(i) &&
        appearance(i) &&
        finite(i.rotation) &&
        (!i.kind || Object.hasOwn(fixtureDefaults, i.kind)) &&
        (!i.furnitureId ||
          p.furniture.some((f: Furniture) => f.id === i.furnitureId)),
    ) ||
    !p.labels.every(
      (l: RoomLabel) =>
        l && point(l) && str(l.name) && /^#[\da-f]{6}$/i.test(l.color),
    )
  )
    throw new Error("寸法またはオブジェクトのデータが不正です。");
  const ids = [...p.walls, ...p.items, ...p.furniture].map((v) => v.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => /^[wif]\d+$/.test(id) && Number(id.slice(1)) >= p.nextId)
  )
    throw new Error("オブジェクトIDが重複または不正です。");
  return p as Project;
}
