import { bounds, type Project } from "./model";
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
) {
  const b = bounds(p);
  if (!callouts.length) return b;
  const minX = Math.min(b.x, ...callouts.map((c) => c.x - 20)),
    minY = Math.min(b.y, ...callouts.map((c) => c.y - 36)),
    maxX = Math.max(b.x + b.width, ...callouts.map((c) => c.x + c.width + 20)),
    maxY = Math.max(b.y + b.height, ...callouts.map((c) => c.y + 36));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
