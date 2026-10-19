import type { Item, Project } from "./model";

export const dimensionCategories = [
  ["walls", "壁の寸法を表示"],
  ["windows", "窓の寸法を表示"],
  ["openings", "ドア・引き戸・開口の寸法を表示"],
  ["furniture", "家具の寸法を表示"],
  ["fixtures", "設備・戸棚の扉の寸法を表示"],
  ["memos", "寸法メモ・点メモを表示"],
  ["areas", "部屋の面積を表示"],
] as const;
export type DimensionCategory = (typeof dimensionCategories)[number][0];
export type DimensionDisplay = Record<DimensionCategory | "enabled", boolean>;

export function readDimensionDisplay(value: unknown): DimensionDisplay {
  const prefs = value && typeof value === "object" ? value : {};
  const saved = "dimensionDisplay" in prefs ? prefs.dimensionDisplay : null;
  const settings = saved && typeof saved === "object" ? saved : {};
  const get = (key: string, fallback: boolean) =>
    key in settings &&
    typeof settings[key as keyof typeof settings] === "boolean"
      ? Boolean(settings[key as keyof typeof settings])
      : fallback;
  return {
    enabled: get("enabled", true),
    walls: get("walls", true),
    windows: get(
      "windows",
      !(
        "showWindowDimensions" in prefs && prefs.showWindowDimensions === false
      ),
    ),
    openings: get("openings", true),
    furniture: get("furniture", false),
    fixtures: get("fixtures", false),
    memos: get("memos", true),
    areas: get("areas", true),
  };
}
export function itemDimensionCategory(item: Item): DimensionCategory {
  if (!item.kind) return "furniture";
  if (item.kind === "window") return "windows";
  if (["door", "sliding", "opening"].includes(item.kind)) return "openings";
  return "fixtures";
}
export function dimensionVisible(
  settings: DimensionDisplay,
  category: DimensionCategory,
) {
  return settings.enabled && settings[category];
}
export function itemDimensionVisible(settings: DimensionDisplay, item: Item) {
  return (
    !item.dimensionHidden &&
    dimensionVisible(settings, itemDimensionCategory(item))
  );
}
/** Only hidden annotation extents are removed; the original project is never edited. */
export function dimensionBoundsProject(
  p: Project,
  settings: DimensionDisplay,
): Project {
  return {
    ...p,
    walls: dimensionVisible(settings, "walls")
      ? p.walls
      : p.walls.map((w) => ({ ...w, dimensionHidden: true })),
    dimensions: dimensionVisible(settings, "memos") ? p.dimensions : [],
    notes: dimensionVisible(settings, "memos") ? p.notes : [],
  };
}
