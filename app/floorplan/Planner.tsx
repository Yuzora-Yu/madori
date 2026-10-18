import WallDimension from "./WallDimension";
import {
  furniturePosition,
  type MoveAxis,
} from "../../packages/floorplan/movement";
import { diagramSvg, diagramPng, fileName } from "./exports";
import PrintPreview from "./PrintPreview";
import {
  wallDimensionLayout,
  windowDimensionEntries,
  furnitureCallouts,
  annotationBounds,
} from "../../packages/floorplan/annotations";
import FurnitureCallouts from "./FurnitureCallouts";
import {
  openingPlacement,
  setOpeningGap,
  resizeOpeningWidth,
  windowElevation,
  interiorRoom,
  resizeRoomInterior,
  wallInsets,
  wallInteriorLength,
} from "../../packages/floorplan/geometry";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  removeDoorLeaf,
  addPointNote,
  translatePointNote,
  translatePointLabel,
  translateDimensionNote,
  addDimensionNote,
  addWall,
  bounds,
  demoProject,
  distance,
  emptyProject,
  fixtureDefaults,
  inside,
  moveItem,
  parseProject,
  placeFixture,
  resizeWall,
  rooms,
  snap,
  STORAGE_KEY,
  type FixtureKind,
  type Furniture,
  type Point,
  type Project,
  type Room,
  type Shape,
} from "../../packages/floorplan/model";
import Icon, { type IconName } from "./Icons";
import PlanItem from "./PlanItem";
import WindowDimensions from "./WindowDimensions";
import DimensionMemo from "./DimensionMemo";
import PointMemo from "./PointMemo";
const Scene3D = lazy(() => import("./Scene3D"));
type Tool = "select" | "wall" | "pan" | "measure" | "note" | FixtureKind;
type Selection =
  | { type: "item" | "wall" | "dimension" | "note"; id: string }
  | { type: "room"; index: number }
  | null;
type View = { x: number; y: number; width: number; height: number };
type Gesture =
  | {
      type: "item";
      before: Project;
      id: string;
      offset: Point;
      shiftAxis?: "x" | "y";
    }
  | {
      type: "note";
      before: Project;
      id: string;
      offset: Point;
      part: "label" | "anchor";
    }
  | {
      type: "wallLabel";
      before: Project;
      id: string;
      offset: Point;
      normal: Point;
      startOffset: number;
    }
  | { type: "dimension"; before: Project; id: string; offset: Point }
  | { type: "wall"; start: Point }
  | { type: "pan"; screen: Point; view: View; scale: number };
const toolList: { id: Tool; icon: IconName; label: string; key?: string }[] = [
  { id: "select", icon: "cursor", label: "選択", key: "V" },
  { id: "wall", icon: "wall", label: "壁を描く", key: "W" },
  { id: "note", icon: "note", label: "メモ", key: "N" },
  { id: "door", icon: "door", label: "ドア" },
  { id: "cabinetDoor", icon: "cabinetDoor", label: "戸棚の扉" },
  { id: "sliding", icon: "sliding", label: "引き戸" },
  { id: "window", icon: "window", label: "窓" },
  { id: "bath", icon: "bath", label: "浴槽" },
  { id: "toilet", icon: "toilet", label: "トイレ" },
  { id: "outlet", icon: "outlet", label: "コンセント" },
];
function loadInitial() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return {
      project: text ? parseProject(text) : demoProject(),
      error: "",
      blocked: false,
    };
  } catch (e) {
    return {
      project: demoProject(),
      error: `保存データを読み込めませんでした。${e instanceof Error ? e.message : ""} 自動保存を停止しています。読込または新規作成で再開できます。`,
      blocked: true,
    };
  }
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Planner() {
  const [initial] = useState(loadInitial);
  const [project, setProject] = useState(initial.project);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [notice, setNotice] = useState(initial.error);
  const [saveStatus, setSaveStatus] = useState("端末内に保存");
  const [tool, setTool] = useState<Tool>("select");
  const [measureDraft, setMeasureDraft] = useState<{
    a: Point;
    b: Point;
  } | null>(null);
  const chooseTool = useCallback((next: Tool) => {
    setTool(next);
    setMeasureDraft(null);
  }, []);
  const [selection, setSelection] = useState<Selection>(null);
  const [moveAxis, setMoveAxis] = useState<MoveAxis>("free");
  const [moveStep, setMoveStep] = useState(1);
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [grid, setGrid] = useState(true),
    [snapping, setSnapping] = useState(true),
    [dimensions, setDimensions] = useState(true),
    [cutaway, setCutaway] = useState(true);
  const [viewPreferences] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem("madori.view.v1") || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  });
  const [seeThrough, setSeeThrough] = useState(
    viewPreferences.seeThrough !== false,
  );
  const [showFurnitureNames, setShowFurnitureNames] = useState(
    viewPreferences.showFurnitureNames === true,
  );
  const [showWindowDimensions, setShowWindowDimensions] = useState(
    viewPreferences.showWindowDimensions !== false,
  );
  useEffect(() => {
    try {
      localStorage.setItem(
        "madori.view.v1",
        JSON.stringify({
          seeThrough,
          showFurnitureNames,
          showWindowDimensions,
        }),
      );
    } catch {
      /* Display settings are optional; project saving reports its own errors. */
    }
  }, [seeThrough, showFurnitureNames, showWindowDimensions]);
  const windowDimensions = useMemo(
    () => (showWindowDimensions ? windowDimensionEntries(project) : []),
    [project, showWindowDimensions],
  );
  const callouts = useMemo(
    () => (showFurnitureNames ? furnitureCallouts(project) : []),
    [project, showFurnitureNames],
  );
  const toggleFurnitureNames = () => {
    const next = !showFurnitureNames;
    setShowFurnitureNames(next);
    if (next)
      setView(
        annotationBounds(project, furnitureCallouts(project), windowDimensions),
      );
  };
  const [view, setView] = useState<View>(() =>
    annotationBounds(initial.project, callouts, windowDimensions),
  );
  const [canvasSize, setCanvasSize] = useState({ width: 700, height: 450 });
  const [draft, setDraft] = useState<{ a: Point; b: Point } | null>(null);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("すべて");
  const [tab, setTab] = useState<"furniture" | "fixtures">("furniture");
  const [furnitureEditor, setFurnitureEditor] = useState<Furniture | null>(
    null,
  );
  const [help, setHelp] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [printPreview, setPrintPreview] = useState<{
    svg: string;
    name: string;
    landscape: boolean;
  } | null>(null);
  const closePrintPreview = useCallback(() => setPrintPreview(null), []);
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 1100px)").matches,
  );
  const [focusMode, setFocusMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(
    () => !window.matchMedia("(max-width: 1100px)").matches,
  );
  const [detailsOpen, setDetailsOpen] = useState(
    () => !window.matchMedia("(max-width: 1100px)").matches,
  );
  const previousPanels = useRef({ library: true, details: true });
  const canvasDimensions = useRef<{ width: number; height: number } | null>(
    null,
  );
  const overlayPanels = compact || focusMode;
  const toggleFocus = useCallback(() => {
    if (focusMode) {
      setLibraryOpen(!compact && previousPanels.current.library);
      setDetailsOpen(!compact && previousPanels.current.details);
    } else {
      previousPanels.current = { library: libraryOpen, details: detailsOpen };
      setLibraryOpen(false);
      setDetailsOpen(false);
    }
    setFocusMode(!focusMode);
  }, [focusMode, compact, libraryOpen, detailsOpen]);
  const togglePanel = (panel: "library" | "details") => {
    if (panel === "library") {
      setLibraryOpen(!libraryOpen);
      if (overlayPanels) setDetailsOpen(false);
    } else {
      setDetailsOpen(!detailsOpen);
      if (overlayPanels) setLibraryOpen(false);
    }
  };
  const closePanel = (panel: "library" | "details") => {
    if (panel === "library") setLibraryOpen(false);
    else setDetailsOpen(false);
    document.getElementById(`${panel}-toggle`)?.focus();
  };
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1100px)");
    const update = () => {
      setCompact(query.matches);
      setLibraryOpen(false);
      setDetailsOpen(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!overlayPanels || (!libraryOpen && !detailsOpen)) return;
    const panel = document.getElementById(
      libraryOpen ? "library-panel" : "details-panel",
    );
    const previous = document.activeElement as HTMLElement | null;
    const elements = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
    elements()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (document.querySelector(".modal") || e.key !== "Tab") return;
      const list = elements(),
        first = list[0],
        last = list.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", handle);
    return () => {
      window.removeEventListener("keydown", handle);
      if (previous?.isConnected) previous.focus();
    };
  }, [overlayPanels, libraryOpen, detailsOpen]);
  const [history, setHistory] = useState<{
    past: Project[];
    future: Project[];
  }>({ past: [], future: [] });
  const svg = useRef<SVGSVGElement>(null),
    importInput = useRef<HTMLInputElement>(null),
    gesture = useRef<Gesture | null>(null);
  const roomList = useMemo(
    () => rooms({ walls: project.walls }),
    [project.walls],
  );
  const selectedItem =
    selection?.type === "item"
      ? project.items.find((i) => i.id === selection.id)
      : undefined;
  const selectedPointNote =
    selection?.type === "note"
      ? project.notes.find((n) => n.id === selection.id)
      : undefined;
  useEffect(() => {
    if (selectedPointNote?.id && detailsOpen)
      document
        .querySelector<HTMLTextAreaElement>("textarea[data-note-text]")
        ?.focus();
  }, [selectedPointNote?.id, detailsOpen]);
  const selectedDimension =
    selection?.type === "dimension"
      ? project.dimensions.find((d) => d.id === selection.id)
      : undefined;
  const selectedWindow =
    selectedItem?.kind === "window" ? selectedItem : undefined;
  const windowPlacement = selectedWindow
    ? openingPlacement(project, selectedWindow)
    : null;
  const selectedWall =
    selection?.type === "wall"
      ? project.walls.find((w) => w.id === selection.id)
      : undefined;
  const selectedRoom =
    selection?.type === "room" ? roomList[selection.index] : undefined;
  const remember = useCallback(
    (before: Project) =>
      setHistory((h) => ({ past: [...h.past.slice(-49), before], future: [] })),
    [],
  );
  const change = useCallback(
    (edit: (p: Project) => void) => {
      const next = structuredClone(project);
      try {
        edit(next);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "変更できませんでした。");
        return;
      }
      remember(project);
      setProject(next);
    },
    [project, remember],
  );
  const undo = useCallback(() => {
    if (!history.past.length) return;
    setProject(history.past[history.past.length - 1]);
    setHistory({
      past: history.past.slice(0, -1),
      future: [project, ...history.future],
    });
    setSelection(null);
  }, [history, project]);
  const redo = useCallback(() => {
    if (!history.future.length) return;
    setProject(history.future[0]);
    setHistory({
      past: [...history.past, project],
      future: history.future.slice(1),
    });
    setSelection(null);
  }, [history, project]);
  const remove = useCallback(() => {
    if (!selection) return;
    change((p) => {
      if (selection.type === "note")
        p.notes = p.notes.filter((n) => n.id !== selection.id);
      if (selection.type === "dimension")
        p.dimensions = p.dimensions.filter((d) => d.id !== selection.id);
      if (selection.type === "item")
        p.items = p.items.filter((i) => i.id !== selection.id);
      else if (selection.type === "wall")
        p.walls = p.walls.filter((w) => w.id !== selection.id);
    });
    setSelection(null);
  }, [selection, change]);
  const fit = useCallback(() => {
    const b = annotationBounds(project, callouts, windowDimensions),
      rect = svg.current?.getBoundingClientRect();
    const aspect = rect ? rect.width / rect.height : 1.3;
    const width = Math.max(b.width, b.height * aspect),
      height = width / aspect;
    setView({
      x: b.x - (width - b.width) / 2,
      y: b.y - (height - b.height) / 2,
      width,
      height,
    });
  }, [project, callouts, windowDimensions]);
  useEffect(() => {
    if (blocked) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        setSaveStatus("端末内に保存済み");
      } catch {
        setSaveStatus("保存できません");
        setNotice(
          "ブラウザの保存領域が使えません。保存ボタンでJSONファイルをダウンロードしてください。",
        );
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [project, blocked]);
  useEffect(() => {
    if (!notice || blocked) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice, blocked]);
  useEffect(() => {
    const failed = () =>
      setNotice(
        "オフライン用の準備ができませんでした。オンラインのまま利用できます。",
      );
    window.addEventListener("madori-offline-error", failed);
    return () => window.removeEventListener("madori-offline-error", failed);
  }, []);
  useEffect(() => {
    const el = svg.current;
    if (!el || mode !== "2d") return;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth,
        height = el.clientHeight;
      if (!width || !height) return;
      const previous = canvasDimensions.current;
      canvasDimensions.current = { width, height };
      setCanvasSize({ width, height });
      setView((v) => {
        const scale = Math.min(
          (previous?.width ?? width) / v.width,
          (previous?.height ?? height) / v.height,
        );
        const nextWidth = width / scale,
          nextHeight = height / scale;
        return {
          x: v.x + (v.width - nextWidth) / 2,
          y: v.y + (v.height - nextHeight) / 2,
          width: nextWidth,
          height: nextHeight,
        };
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]);
  useEffect(() => {
    if (!furnitureEditor && !help) return;
    const previous = document.activeElement as HTMLElement | null;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        setFurnitureEditor(null);
        setHelp(false);
      }
      if (e.key === "Tab") {
        const list = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".modal button,.modal input,.modal select",
          ),
        ).filter((el) => !el.hasAttribute("disabled"));
        const first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handle, true);
    if (help) document.querySelector<HTMLElement>(".modal button")?.focus();
    return () => {
      window.removeEventListener("keydown", handle, true);
      previous?.focus();
    };
  }, [furnitureEditor, help]);
  useEffect(() => {
    const el = svg.current;
    if (!el || mode !== "2d") return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const matrix = el.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
        matrix.inverse(),
      );
      const scale = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      setView((v) => {
        const width = Math.min(30000, Math.max(150, v.width * scale)),
          ratio = width / v.width;
        return {
          x: point.x - (point.x - v.x) * ratio,
          y: point.y - (point.y - v.y) * ratio,
          width,
          height: v.height * ratio,
        };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [mode]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (furnitureEditor || help || printPreview) return;
      if (
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
      )
        return;
      if (
        mode === "2d" &&
        selectedItem &&
        (!selectedItem.kind || selectedItem.wallSnap === false) &&
        !gesture.current &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.startsWith("Arrow")
      ) {
        const direction = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        }[e.key];
        if (direction) {
          e.preventDefault();
          const amount = moveStep * (e.shiftKey ? 10 : 1);
          change((p) => {
            const item = p.items.find((i) => i.id === selectedItem.id)!;
            Object.assign(
              item,
              furniturePosition(
                item,
                { x: direction[0] * amount, y: direction[1] * amount },
                0,
                "free",
              ),
            );
          });
          return;
        }
      }
      if (e.key === "Escape") {
        if (overlayPanels && (libraryOpen || detailsOpen)) {
          e.preventDefault();
          setLibraryOpen(false);
          setDetailsOpen(false);
          return;
        }
        if (focusMode && !gesture.current) {
          e.preventDefault();
          toggleFocus();
          return;
        }
        const g = gesture.current;
        if (
          g?.type === "item" ||
          g?.type === "dimension" ||
          g?.type === "note" ||
          g?.type === "wallLabel"
        )
          setProject(g.before);
        gesture.current = null;
        setDraft(null);
        chooseTool("select");
        setSelection(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      if (
        e.key.toLowerCase() === "f" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        toggleFocus();
      }
      if (e.key.toLowerCase() === "v") chooseTool("select");
      if (e.key.toLowerCase() === "w") chooseTool("wall");
      if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey && !e.altKey)
        chooseTool("note");
      if (e.key.toLowerCase() === "m" && !e.ctrlKey && !e.metaKey && !e.altKey)
        chooseTool("measure");
      if (e.key.toLowerCase() === "r" && selectedItem)
        change((p) => {
          p.items.find((i) => i.id === selectedItem.id)!.rotation =
            (selectedItem.rotation + 90) % 360;
        });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    undo,
    redo,
    remove,
    selectedItem,
    mode,
    moveStep,
    change,
    furnitureEditor,
    help,
    printPreview,
    focusMode,
    toggleFocus,
    chooseTool,
    overlayPanels,
    libraryOpen,
    detailsOpen,
  ]);
  function nudgeFurniture(dx: number, dy: number) {
    if (
      !selectedItem ||
      (selectedItem.kind && selectedItem.wallSnap !== false) ||
      gesture.current
    )
      return;
    change((p) => {
      const item = p.items.find((i) => i.id === selectedItem.id)!;
      Object.assign(item, furniturePosition(item, { x: dx, y: dy }, 0, "free"));
    });
  }
  function world(e: { clientX: number; clientY: number }): Point {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const v = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: v.x, y: v.y };
  }
  const snapped = (p: Point) => ({
    x: snap(p.x, snapping),
    y: snap(p.y, snapping),
  });
  function pointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (![0, 1, 2].includes(e.button)) return;
    const point = snapped(world(e));
    svg.current?.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || tool === "pan" || e.altKey) {
      e.preventDefault();
      const m = svg.current?.getScreenCTM();
      gesture.current = {
        type: "pan",
        screen: { x: e.clientX, y: e.clientY },
        view,
        scale: m?.a || 1,
      };
      return;
    }
    if (tool === "note") {
      e.preventDefault();
      let id = "";
      change((p) => {
        id = addPointNote(p, point).id;
      });
      setSelection({ type: "note", id });
      chooseTool("select");
      if (overlayPanels) setLibraryOpen(false);
      setDetailsOpen(true);
      return;
    }
    if (tool === "measure") {
      if (!measureDraft) setMeasureDraft({ a: point, b: point });
      else {
        if (distance(measureDraft.a, point) < 1) {
          setNotice("少し離れた2点を指定してください。");
          return;
        }
        let id = "";
        change((p) => {
          id = addDimensionNote(p, measureDraft.a, point).id;
        });
        setSelection({ type: "dimension", id });
        chooseTool("select");
        if (!compact && !focusMode) setDetailsOpen(true);
        setNotice(
          "寸法メモを追加しました。「寸法を編集」または設定から実測値とメモを入力できます。",
        );
      }
      return;
    }
    if (tool === "wall") {
      gesture.current = { type: "wall", start: point };
      setDraft({ a: point, b: point });
      setSelection(null);
      return;
    }
    if (tool !== "select") {
      let id = "";
      change((p) => {
        id = placeFixture(p, tool as FixtureKind, point).id;
      });
      setSelection({ type: "item", id });
      chooseTool("select");
      return;
    }
    setSelection(null);
  }
  function pointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    if (tool === "measure" && measureDraft && !g)
      setMeasureDraft({ ...measureDraft, b: snapped(world(e)) });
    if (!g) return;
    if (g.type === "wall") {
      setDraft({ a: g.start, b: snapped(world(e)) });
    }
    if (g.type === "pan") {
      setView({
        ...g.view,
        x: g.view.x - (e.clientX - g.screen.x) / g.scale,
        y: g.view.y - (e.clientY - g.screen.y) / g.scale,
      });
    }
    if (g.type === "note") {
      const pt = world(e),
        dx = Math.round(pt.x - g.offset.x),
        dy = Math.round(pt.y - g.offset.y);
      setProject({
        ...g.before,
        notes: g.before.notes.map((n) =>
          n.id === g.id
            ? g.part === "label"
              ? translatePointLabel(n, dx, dy)
              : translatePointNote(n, dx, dy)
            : n,
        ),
      });
    }
    if (g.type === "wallLabel") {
      const pt = world(e),
        value = Math.round(
          g.startOffset +
            (pt.x - g.offset.x) * g.normal.x +
            (pt.y - g.offset.y) * g.normal.y,
        );
      setProject({
        ...g.before,
        walls: g.before.walls.map((w) =>
          w.id === g.id
            ? { ...w, dimensionOffset: Math.max(-2000, Math.min(2000, value)) }
            : w,
        ),
      });
    }
    if (g.type === "dimension") {
      const pt = world(e),
        original = g.before.dimensions.find((d) => d.id === g.id)!;
      const dx = snap(pt.x - g.offset.x, snapping),
        dy = snap(pt.y - g.offset.y, snapping);
      setProject({
        ...g.before,
        dimensions: g.before.dimensions.map((d) =>
          d.id === g.id ? translateDimensionNote(original, dx, dy) : d,
        ),
      });
    }
    if (g.type === "item") {
      const pt = world(e),
        p = {
          ...g.before,
          items: g.before.items.map((i) => (i.id === g.id ? { ...i } : i)),
        },
        item = p.items.find((i) => i.id === g.id)!;
      const delta = {
        x: pt.x - g.offset.x - item.x,
        y: pt.y - g.offset.y - item.y,
      };
      if (e.shiftKey && !g.shiftAxis && Math.hypot(delta.x, delta.y) > 3)
        g.shiftAxis = Math.abs(delta.x) >= Math.abs(delta.y) ? "x" : "y";
      if (!e.shiftKey) g.shiftAxis = undefined;
      moveItem(
        p,
        item,
        item.kind && item.wallSnap !== false
          ? snapped({ x: pt.x - g.offset.x, y: pt.y - g.offset.y })
          : furniturePosition(
              item,
              delta,
              snapping ? moveStep : 0,
              moveAxis === "free" ? (g.shiftAxis ?? "free") : moveAxis,
            ),
      );
      setProject(p);
    }
  }
  function pointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    gesture.current = null;
    setDraft(null);
    if (svg.current?.hasPointerCapture(e.pointerId))
      svg.current.releasePointerCapture(e.pointerId);
    if (g?.type === "wall") {
      const pt = snapped(world(e));
      if (distance(g.start, pt) >= 10) change((p) => addWall(p, g.start, pt));
    }
    if (
      (g?.type === "item" ||
        g?.type === "dimension" ||
        g?.type === "note" ||
        g?.type === "wallLabel") &&
      JSON.stringify(g.before) !== JSON.stringify(project)
    )
      remember(g.before);
  }
  function selectItem(e: React.PointerEvent<SVGGElement>, id: string) {
    if (tool !== "select" || e.altKey || e.button !== 0) return;
    e.stopPropagation();
    const item = project.items.find((i) => i.id === id)!,
      pt = world(e);
    setSelection({ type: "item", id });
    gesture.current = {
      type: "item",
      before: project,
      id,
      offset: { x: pt.x - item.x, y: pt.y - item.y },
    };
    svg.current?.setPointerCapture(e.pointerId);
  }
  function placeFurniture(f: Furniture) {
    let id = "";
    change((p) => {
      id = `i${p.nextId++}`;
      p.items.push({
        ...f,
        id,
        furnitureId: f.id,
        x: snap(view.x + view.width / 2, true),
        y: snap(view.y + view.height / 2, true),
        rotation: 0,
      });
    });
    setSelection({ type: "item", id });
    chooseTool("select");
    setMode("2d");
    if (overlayPanels) setLibraryOpen(false);
    setNotice(`${f.name}を配置しました。ドラッグで位置を調整できます。`);
  }
  function setItem(key: string, value: string | number) {
    if (selectedItem?.kind === "window" && key === "width") {
      change((p) => resizeOpeningWidth(p, selectedItem.id, Number(value)));
      return;
    }
    if (selectedItem)
      change((p) =>
        Object.assign(
          p.items.find((i) => i.id === selectedItem.id)!,
          { [key]: value },
        ),
      );
  }
  function save() {
    download(
      new Blob([JSON.stringify(project, null, 2)], {
        type: "application/json",
      }),
      `${project.name.replace(/[<>:"/\\|?*]/g, "_")}.madori.json`,
    );
    setNotice("間取りと家具一覧をJSONファイルに保存しました。");
  }
  async function importFile(file: File) {
    try {
      if (file.size > 5_000_000)
        throw new Error("5MB以下のJSONファイルを選択してください。");
      const p = parseProject(await file.text());
      remember(project);
      setProject(p);
      setBlocked(false);
      setSelection(null);
      setMode("2d");
      const b = bounds(p);
      setView(b);
      setNotice("間取りを読み込みました。");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "読込に失敗しました。");
    }
  }
  function newProject(demo = false) {
    if (
      !window.confirm(
        "現在の間取りは自動保存から置き換わります。必要なら先に「保存」でファイルを保存してください。続けますか？",
      )
    )
      return;
    remember(project);
    const p = demo ? demoProject() : emptyProject();
    setProject(p);
    setSelection(null);
    setBlocked(false);
    setMode("2d");
    setView(bounds(p));
    chooseTool(demo ? "select" : "wall");
  }
  function exportSvg() {
    if (!svg.current) return;
    const b = annotationBounds(project, callouts, windowDimensions);
    download(
      new Blob([diagramSvg(svg.current, b, project.name)], {
        type: "image/svg+xml",
      }),
      `${fileName(project.name)}.svg`,
    );
  }
  async function exportImage() {
    if (!svg.current || exportBusy) return;
    setExportBusy(true);
    try {
      const b = annotationBounds(project, callouts, windowDimensions);
      const blob = await diagramPng(svg.current, b, project.name);
      download(blob, `${fileName(project.name)}.png`);
      setNotice("PNG画像を保存しました。");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "画像を保存できませんでした。",
      );
    } finally {
      setExportBusy(false);
    }
  }
  function openPrint() {
    if (!svg.current) return;
    const b = annotationBounds(project, callouts, windowDimensions);
    setPrintPreview({
      svg: diagramSvg(svg.current, b, project.name),
      name: project.name,
      landscape: b.width > b.height,
    });
  }
  function roomLabel(room: Room) {
    return project.labels.find((l) => inside(l, room.points));
  }
  function renameRoom(name: string) {
    if (!selectedRoom) return;
    change((p) => {
      let label = p.labels.find((l) => inside(l, selectedRoom.points));
      if (!label) {
        label = { ...selectedRoom.center, name, color: "#ede9df" };
        p.labels.push(label);
      }
      label.name = name;
    });
  }
  const filtered = project.furniture.filter(
    (f) =>
      (category === "すべて" || f.category === category) &&
      f.name.includes(search),
  );
  const totalArea = roomList.reduce(
    (sum, r) => sum + interiorRoom(project, r).area,
    0,
  );
  return (
    <div
      className={`planner ${focusMode ? "focus-mode" : ""} ${overlayPanels ? "overlay-panels" : ""} ${libraryOpen ? "library-open" : ""} ${detailsOpen ? "details-open" : ""}`}
    >
      <header className="app-header" hidden={focusMode}>
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-symbol">
            <Icon name="plan" size={25} />
          </span>
          <span>
            madori<span className="brand-dot">.</span>
          </span>
          <small>暮らしを、描こう。</small>
        </a>
        <div className="project-heading">
          <input
            aria-label="プロジェクト名"
            value={project.name}
            maxLength={80}
            onChange={(e) =>
              change((p) => {
                p.name = e.target.value;
              })
            }
          />
          <span className={`save-state ${blocked ? "warn" : ""}`}>
            <span />
            {blocked ? "自動保存停止中" : saveStatus}
          </span>
        </div>
        <div className="header-actions">
          <details
            className="project-menu"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button"))
                e.currentTarget.open = false;
            }}
          >
            <summary aria-label="間取りメニュー" title="間取りメニュー">
              <Icon name="plan" size={18} />
            </summary>
            <div>
              <button onClick={() => newProject(false)}>
                <Icon name="plus" size={16} />
                新しい間取り
              </button>
              <button onClick={() => newProject(true)}>サンプルを開く</button>
              <button onClick={() => setHelp(true)}>
                <Icon name="help" size={16} />
                使い方
              </button>
              <button
                onClick={() => {
                  setMode("2d");
                  chooseTool("measure");
                }}
              >
                2点の寸法メモを追加（M）
              </button>
              <button disabled={mode === "3d"} onClick={exportSvg}>
                <Icon name="download" size={16} />
                2D図面をSVG出力
              </button>
            </div>
          </details>
          <button
            className="quiet-button"
            aria-label="読込"
            title="間取りファイルを読込"
            onClick={() => importInput.current?.click()}
          >
            <Icon name="upload" size={17} />
            <span>読込</span>
          </button>
          <button className="primary-button" onClick={save}>
            <Icon name="download" size={17} />
            保存
          </button>
          <button
            className="icon-button"
            title="使い方"
            aria-label="使い方"
            onClick={() => setHelp(true)}
          >
            <Icon name="help" />
          </button>
        </div>
        <input
          ref={importInput}
          hidden
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = "";
          }}
        />
      </header>
      <div className="workspace">
        {overlayPanels && (libraryOpen || detailsOpen) && (
          <button
            className="panel-backdrop"
            aria-label="パネルを閉じて図面に戻る"
            onClick={() => closePanel(libraryOpen ? "library" : "details")}
          />
        )}
        <aside
          id="library-panel"
          className="library-panel"
          aria-label="家具と設備"
          hidden={!libraryOpen}
          role={overlayPanels ? "dialog" : undefined}
          aria-modal={overlayPanels && libraryOpen ? true : undefined}
        >
          <div className="panel-heading">
            <div>
              <span className="eyebrow">YOUR COLLECTION</span>
              <h2>家具と設備</h2>
            </div>
            <div className="panel-heading-actions">
              <span className="collection-count">
                {project.furniture.length}
              </span>
              <button
                className="icon-button"
                aria-label="家具パネルを閉じる"
                onClick={() => closePanel("library")}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>
          <div className="side-tabs">
            <button
              className={tab === "furniture" ? "active" : ""}
              onClick={() => setTab("furniture")}
            >
              家具ライブラリ
            </button>
            <button
              className={tab === "fixtures" ? "active" : ""}
              onClick={() => setTab("fixtures")}
            >
              建具・設備
            </button>
          </div>
          {tab === "furniture" ? (
            <>
              <button
                className="create-furniture"
                onClick={() =>
                  setFurnitureEditor({
                    id: "",
                    name: "",
                    category: "収納",
                    width: 100,
                    depth: 40,
                    height: 80,
                    color: "#b9a184",
                    shape: "generic",
                  })
                }
              >
                <Icon name="plus" size={18} />
                家具をつくる
              </button>
              <button
                className="create-furniture"
                onClick={() =>
                  setFurnitureEditor({
                    id: "",
                    name: "造作棚",
                    category: "造作",
                    width: 120,
                    depth: 35,
                    height: 180,
                    color: "#b9a184",
                    shape: "shelf",
                    shelfLevels: 4,
                    baseElevation: 0,
                  })
                }
              >
                <Icon name="shelf" size={18} />
                造作棚をつくる
              </button>
              <div className="library-filters">
                <input
                  aria-label="家具を検索"
                  placeholder="家具を検索…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="家具の分類"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {[
                    "すべて",
                    ...new Set(project.furniture.map((f) => f.category)),
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="furniture-list">
                {filtered.map((f) => (
                  <article className="furniture-card" key={f.id}>
                    <div
                      className="furniture-thumbnail"
                      style={{ color: f.color }}
                    >
                      <Icon name={f.shape} size={42} />
                    </div>
                    <div className="furniture-info">
                      <span className="furniture-category">{f.category}</span>
                      <h3>{f.name}</h3>
                      <p>
                        {f.width} × {f.depth} × {f.height} <small>cm</small>
                      </p>
                      <div className="furniture-actions">
                        <button onClick={() => placeFurniture(f)}>
                          配置する
                          <Icon name="plus" size={14} />
                        </button>
                        <button
                          className="edit-furniture"
                          onClick={() => setFurnitureEditor(f)}
                          aria-label={`${f.name}を編集`}
                        >
                          編集
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {!filtered.length && (
                  <div className="empty-state">
                    該当する家具がありません。
                    <br />
                    自分の家具を登録してみましょう。
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="fixture-library">
              <p>設備を選び、間取り上をクリックして配置します。</p>
              {(
                Object.entries(fixtureDefaults) as [
                  FixtureKind,
                  typeof fixtureDefaults.door,
                ][]
              ).map(([kind, f]) => (
                <button
                  key={kind}
                  className={tool === kind ? "active" : ""}
                  onClick={() => {
                    chooseTool(kind);
                    setMode("2d");
                    if (overlayPanels) setLibraryOpen(false);
                    setNotice(
                      `${f.name}を置く位置を図面でクリック・タップしてください。`,
                    );
                  }}
                >
                  <Icon name={kind} size={27} />
                  <span>
                    <strong>{f.name}</strong>
                    <small>
                      {f.width} × {f.depth} cm
                    </small>
                  </span>
                  <Icon name="plus" size={16} />
                </button>
              ))}
            </div>
          )}
          <div className="library-footer">
            <Icon name="check" size={16} />
            <span>クラウド不要。データはこの端末内に。</span>
          </div>
        </aside>
        <main className="editor-panel">
          <div className="editor-header">
            <div className="workspace-navigation" aria-label="編集画面の表示">
              <button
                id="library-toggle"
                className="workspace-button"
                aria-controls="library-panel"
                aria-expanded={libraryOpen}
                onClick={() => togglePanel("library")}
              >
                <Icon name="sofa" size={18} />
                <span>家具・設備</span>
              </button>
              <button
                id="details-toggle"
                className="workspace-button"
                aria-controls="details-panel"
                aria-expanded={detailsOpen}
                onClick={() => togglePanel("details")}
              >
                <Icon name="settings" size={18} />
                <span>設定</span>
              </button>
            </div>
            <h1 className="editor-title">間取り編集</h1>
            <div className="editor-view-actions">
              <div className="view-switch">
                <button
                  className={mode === "2d" ? "active" : ""}
                  onClick={() => setMode("2d")}
                >
                  <Icon name="plan" size={17} />
                  2D
                </button>
                <button
                  className={mode === "3d" ? "active" : ""}
                  onClick={() => {
                    setMode("3d");
                    chooseTool("select");
                  }}
                >
                  <Icon name="box" size={17} />
                  3D
                </button>
              </div>
              {focusMode && (
                <button
                  aria-label="保存"
                  className="workspace-button focus-save"
                  onClick={save}
                  title="JSONファイルに保存"
                >
                  <Icon name="download" size={18} />
                  <span>保存</span>
                </button>
              )}
              <button
                aria-label={focusMode ? "通常表示に戻す" : "広く使う"}
                className="workspace-button focus-toggle"
                aria-pressed={focusMode}
                title="編集画面を広く使う（F）・Escで戻る"
                onClick={toggleFocus}
              >
                <Icon name={focusMode ? "collapse" : "expand"} size={18} />
                <span>{focusMode ? "通常表示に戻す" : "広く使う"}</span>
              </button>
            </div>
          </div>
          <div className={`toolbar ${mode === "3d" ? "toolbar-3d" : ""}`}>
            <div className="drawing-tools">
              {toolList.map((t) => (
                <button
                  key={t.id}
                  title={`${t.label}${t.key ? ` (${t.key})` : ""}`}
                  aria-label={t.label}
                  aria-pressed={tool === t.id}
                  className={tool === t.id ? "active" : ""}
                  disabled={mode === "3d"}
                  onClick={() => {
                    chooseTool(t.id);
                    setSelection(null);
                  }}
                >
                  <Icon name={t.icon} />
                  {(t.id === "select" || t.id === "wall") && (
                    <span>{t.label}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="display-tools" aria-label="2Dの表示切替">
              <button
                aria-label="窓の寸法を常時表示"
                title="窓の幅・高さ・壁からの距離を表示"
                aria-pressed={showWindowDimensions}
                className={showWindowDimensions ? "active" : ""}
                onClick={() => setShowWindowDimensions(!showWindowDimensions)}
              >
                <Icon name="ruler" size={18} />
                <span>窓寸法</span>
              </button>
              <button
                aria-label="家具を半透明にする"
                title="家具を半透明にする"
                aria-pressed={seeThrough}
                className={seeThrough ? "active" : ""}
                onClick={() => setSeeThrough(!seeThrough)}
              >
                <Icon name="layers" size={18} />
                <span>透過</span>
              </button>
              <button
                aria-label="家具名を図面の外に表示"
                title="家具名を図面の外に表示"
                aria-pressed={showFurnitureNames}
                className={showFurnitureNames ? "active" : ""}
                onClick={toggleFurnitureNames}
              >
                <Icon name="label" size={18} />
                <span>家具名</span>
              </button>
            </div>
            <div className="export-tools" aria-label="図面の保存と印刷">
              <button
                aria-label="PNG画像として保存"
                title="2D図面をPNG画像として保存"
                disabled={mode === "3d" || exportBusy}
                onClick={() => void exportImage()}
              >
                <Icon name="image" size={18} />
                <span>{exportBusy ? "作成中…" : "画像保存"}</span>
              </button>
              <button
                aria-label="A4で印刷"
                title="2D図面をA4で印刷"
                disabled={mode === "3d"}
                onClick={openPrint}
              >
                <Icon name="print" size={18} />
                <span>A4印刷</span>
              </button>
            </div>
            <div className="history-tools">
              <button
                aria-label="元に戻す"
                title="元に戻す (Ctrl+Z)"
                disabled={!history.past.length}
                onClick={undo}
              >
                <Icon name="undo" size={18} />
              </button>
              <button
                aria-label="やり直す"
                title="やり直す (Ctrl+Shift+Z)"
                disabled={!history.future.length}
                onClick={redo}
              >
                <Icon name="redo" size={18} />
              </button>
            </div>
          </div>
          {mode === "2d" && (
            <div
              className="furniture-move-bar"
              role="group"
              aria-label="家具の移動と微調整"
            >
              <span className="move-item-name" title={selectedItem?.name}>
                {selectedItem &&
                (!selectedItem.kind || selectedItem.wallSnap === false)
                  ? selectedItem.name
                  : "家具を選択して移動"}
              </span>
              <label>
                ドラッグ
                <select
                  aria-label="家具を動かす方向"
                  value={moveAxis}
                  onChange={(e) => setMoveAxis(e.target.value as MoveAxis)}
                >
                  <option value="free">自由</option>
                  <option value="x">横だけ ↔</option>
                  <option value="y">縦だけ ↕</option>
                </select>
              </label>
              <label>
                移動幅
                <select
                  aria-label="家具の移動幅"
                  value={moveStep}
                  onChange={(e) => setMoveStep(Number(e.target.value))}
                >
                  <option value={0.1}>1 mm</option>
                  <option value={1}>1 cm</option>
                  <option value={10}>10 cm</option>
                </select>
              </label>
              <div
                className="nudge-buttons"
                role="group"
                aria-label="家具を少しずつ移動"
              >
                {(
                  [
                    ["左", "←", -1, 0],
                    ["上", "↑", 0, -1],
                    ["下", "↓", 0, 1],
                    ["右", "→", 1, 0],
                  ] as const
                ).map(([name, arrow, dx, dy]) => (
                  <button
                    key={name}
                    disabled={
                      !selectedItem ||
                      (!!selectedItem.kind && selectedItem.wallSnap !== false)
                    }
                    aria-label={`家具を${name}へ移動`}
                    title={`${name}へ${moveStep} cm`}
                    onClick={() => nudgeFurniture(dx * moveStep, dy * moveStep)}
                  >
                    {arrow}
                  </button>
                ))}
              </div>
              <small>
                矢印キーで微調整 · Shift＋矢印で10倍 · Shift＋ドラッグで方向固定
              </small>
            </div>
          )}
          <div className={`canvas-wrap tool-${tool}`}>
            {selection && !detailsOpen && (
              <button
                className="selection-edit"
                onClick={() => togglePanel("details")}
              >
                <Icon name="settings" size={17} />
                <span>
                  {selectedPointNote
                    ? "メモ"
                    : selectedDimension
                      ? "寸法メモ"
                      : selectedItem?.name ||
                        (selectedWall
                          ? "選択中の壁"
                          : (selectedRoom
                              ? roomLabel(selectedRoom)?.name
                              : undefined) || "選択中の部屋")}
                </span>
                <strong>寸法を編集</strong>
                <Icon name="chevron" size={15} />
              </button>
            )}
            {mode === "2d" ? (
              <svg
                ref={svg}
                className="plan-canvas"
                viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={() => {
                  const g = gesture.current;
                  if (
                    g?.type === "item" ||
                    g?.type === "dimension" ||
                    g?.type === "note" ||
                    g?.type === "wallLabel"
                  )
                    setProject(g.before);
                  gesture.current = null;
                  setDraft(null);
                }}
                onContextMenu={(e) => e.preventDefault()}
                aria-label="間取り編集キャンバス"
              >
                <defs>
                  <pattern
                    id="fine-grid"
                    width="10"
                    height="10"
                    patternUnits="userSpaceOnUse"
                  >
                    <circle cx="0" cy="0" r="0.65" fill="#c9cdc0" />
                  </pattern>
                  <pattern
                    id="floor-grain"
                    width="25"
                    height="120"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M0 0V120 M0 0h25 M0 60h12.5"
                      stroke="#d3c6aa"
                      strokeWidth="0.6"
                      opacity="0.28"
                    />
                  </pattern>
                </defs>
                <rect
                  x={view.x - 10000}
                  y={view.y - 10000}
                  width={view.width + 20000}
                  height={view.height + 20000}
                  fill="#f7f7f2"
                />
                {grid && (
                  <rect
                    x={view.x - 10000}
                    y={view.y - 10000}
                    width={view.width + 20000}
                    height={view.height + 20000}
                    fill="url(#fine-grid)"
                  />
                )}
                {roomList.map((r, index) => {
                  const label = roomLabel(r),
                    active =
                      selection?.type === "room" && selection.index === index;
                  return (
                    <g
                      key={index}
                      onPointerDown={(e) => {
                        if (tool === "select" && !e.altKey && e.button === 0) {
                          e.stopPropagation();
                          setSelection({ type: "room", index });
                        }
                      }}
                    >
                      <polygon
                        points={r.points.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill={label?.color || "#eee9de"}
                        stroke={active ? "#80aa8b" : "none"}
                        strokeWidth="4"
                      />
                      <polygon
                        points={r.points.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="url(#floor-grain)"
                      />
                    </g>
                  );
                })}
                {project.walls.map((w) => (
                  <g
                    key={w.id}
                    onPointerDown={(e) => {
                      if (tool === "select" && !e.altKey && e.button === 0) {
                        e.stopPropagation();
                        setSelection({ type: "wall", id: w.id });
                      }
                    }}
                  >
                    <line
                      x1={w.a.x}
                      y1={w.a.y}
                      x2={w.b.x}
                      y2={w.b.y}
                      stroke="transparent"
                      strokeWidth={Math.max(20, w.thickness + 8)}
                    />
                    <line
                      x1={w.a.x}
                      y1={w.a.y}
                      x2={w.b.x}
                      y2={w.b.y}
                      stroke={selectedWall?.id === w.id ? "#337d60" : "#697268"}
                      strokeWidth={w.thickness}
                      strokeLinecap="square"
                    />
                    {selectedWall?.id === w.id &&
                      [w.a, w.b].map((pt, i) => (
                        <circle
                          key={i}
                          data-editor-only="wall-endpoint"
                          cx={pt.x}
                          cy={pt.y}
                          r="6"
                          fill="#f7faf3"
                          stroke="#337d60"
                          strokeWidth="2"
                        />
                      ))}
                  </g>
                ))}
                {project.items.map((i) => (
                  <PlanItem
                    key={i.id}
                    item={i}
                    selected={selectedItem?.id === i.id}
                    seeThrough={seeThrough}
                    onPointerDown={(e) => selectItem(e, i.id)}
                  />
                ))}
                {roomList.map((r, index) => (
                  <g key={`room-caption-${index}`} pointerEvents="none">
                    <text
                      x={r.center.x}
                      y={r.center.y - 4}
                      textAnchor="middle"
                      className="room-name"
                    >
                      {roomLabel(r)?.name || `部屋 ${index + 1}`}
                    </text>
                    <text
                      x={r.center.x}
                      y={r.center.y + 16}
                      textAnchor="middle"
                      className="room-area"
                    >
                      {interiorRoom(project, r).area.toFixed(1)} m²
                    </text>
                  </g>
                ))}
                {dimensions &&
                  project.walls.map((w) => {
                    const entry = wallDimensionLayout(project, w, roomList);
                    return (
                      <WallDimension
                        key={`dim-${w.id}`}
                        entry={entry}
                        selected={selectedWall?.id === w.id}
                        onPointerDown={(e) => {
                          if (tool !== "select" || e.altKey || e.button !== 0)
                            return;
                          e.stopPropagation();
                          setSelection({ type: "wall", id: w.id });
                          gesture.current = {
                            type: "wallLabel",
                            before: project,
                            id: w.id,
                            offset: world(e),
                            normal: entry.normal,
                            startOffset: entry.offset,
                          };
                          svg.current?.setPointerCapture(e.pointerId);
                        }}
                      />
                    );
                  })}
                {showFurnitureNames && <FurnitureCallouts entries={callouts} />}
                {project.notes.map((n) => (
                  <PointMemo
                    key={n.id}
                    entry={n}
                    selected={selectedPointNote?.id === n.id}
                    onPointerDown={(e, part) => {
                      if (tool !== "select" || e.altKey || e.button !== 0)
                        return;
                      e.stopPropagation();
                      setSelection({ type: "note", id: n.id });
                      gesture.current = {
                        type: "note",
                        part,
                        before: project,
                        id: n.id,
                        offset: world(e),
                      };
                      svg.current?.setPointerCapture(e.pointerId);
                    }}
                  />
                ))}
                {project.dimensions.map((d) => (
                  <DimensionMemo
                    key={d.id}
                    entry={d}
                    selected={selectedDimension?.id === d.id}
                    onPointerDown={(e) => {
                      if (tool !== "select" || e.altKey || e.button !== 0)
                        return;
                      e.stopPropagation();
                      setSelection({ type: "dimension", id: d.id });
                      gesture.current = {
                        type: "dimension",
                        before: project,
                        id: d.id,
                        offset: world(e),
                      };
                      svg.current?.setPointerCapture(e.pointerId);
                    }}
                  />
                ))}
                {tool === "measure" && measureDraft && (
                  <g data-editor-only="measure-draft">
                    <DimensionMemo
                      entry={{
                        id: "draft",
                        ...measureDraft,
                        note: "2点目をクリック・タップ",
                      }}
                      selected={false}
                    />
                  </g>
                )}
                {windowDimensions.map((w) => (
                  <WindowDimensions
                    key={w.item.id}
                    item={w.item}
                    placement={w.placement}
                    offset={w.offset}
                    selected={selectedWindow?.id === w.item.id}
                  />
                ))}
                {!showWindowDimensions && selectedWindow && windowPlacement && (
                  <WindowDimensions
                    item={selectedWindow}
                    placement={windowPlacement}
                    selected
                    editorOnly
                  />
                )}
                {draft && (
                  <g pointerEvents="none">
                    <line
                      x1={draft.a.x}
                      y1={draft.a.y}
                      x2={draft.b.x}
                      y2={draft.b.y}
                      stroke="#3f8b68"
                      strokeWidth="10"
                      strokeDasharray="12 4"
                    />
                    <circle
                      cx={draft.a.x}
                      cy={draft.a.y}
                      r="6"
                      fill="#3f8b68"
                    />
                    <text
                      x={(draft.a.x + draft.b.x) / 2}
                      y={(draft.a.y + draft.b.y) / 2 - 20}
                      className="dim-label"
                      textAnchor="middle"
                    >
                      {Math.round(distance(draft.a, draft.b))} cm
                    </text>
                  </g>
                )}
              </svg>
            ) : (
              <Suspense
                fallback={
                  <div className="scene-error">3Dビューを準備しています…</div>
                }
              >
                <Scene3D project={project} cutaway={cutaway} />
              </Suspense>
            )}
            <div className="canvas-badge">
              <span />
              {mode === "2d" ? "TOP VIEW" : "PERSPECTIVE"}
              <span className="badge-separator">/</span>
              {project.name}
            </div>
            {mode === "2d" && (
              <>
                <div className="canvas-instruction">
                  {tool === "wall"
                    ? "ドラッグで壁を描く · 壁を選択して寸法を指定"
                    : tool === "note"
                      ? "メモを残す場所をクリック・タップ"
                      : tool === "measure"
                        ? measureDraft
                          ? "2点目をクリック・タップして寸法メモを追加"
                          : "1点目をクリック・タップ · 次に2点目を指定"
                        : tool === "select"
                          ? "家具をドラッグで移動 · Shiftで縦横固定 · 右ドラッグで画面を移動"
                          : tool === "pan"
                            ? "ドラッグで画面を移動"
                            : `${fixtureDefaults[tool].name}を置く位置をクリック`}
                </div>
                <div className="zoom-controls">
                  <button
                    aria-label="縮小"
                    onClick={() =>
                      setView((v) => ({
                        ...v,
                        x: v.x - v.width * 0.1,
                        y: v.y - v.height * 0.1,
                        width: v.width * 1.2,
                        height: v.height * 1.2,
                      }))
                    }
                  >
                    <Icon name="minus" size={17} />
                  </button>
                  <span>
                    {Math.round(
                      Math.min(
                        canvasSize.width / view.width,
                        canvasSize.height / view.height,
                      ) * 100,
                    )}
                    %
                  </span>
                  <button
                    aria-label="拡大"
                    onClick={() =>
                      setView((v) => ({
                        ...v,
                        x: v.x + v.width / 12,
                        y: v.y + v.height / 12,
                        width: v.width / 1.2,
                        height: v.height / 1.2,
                      }))
                    }
                  >
                    <Icon name="plus" size={17} />
                  </button>
                  <i />
                  <button
                    aria-label="間取り全体を表示"
                    title="全体を表示"
                    onClick={fit}
                  >
                    <Icon name="fit" size={18} />
                  </button>
                  <button
                    className={tool === "pan" ? "active" : ""}
                    aria-label="画面を移動"
                    title="画面を移動"
                    onClick={() =>
                      chooseTool(tool === "pan" ? "select" : "pan")
                    }
                  >
                    <Icon name="cursor" size={18} />
                  </button>
                </div>
                <div className="scale-bar">
                  <span
                    style={{
                      width: `${100 * Math.min(canvasSize.width / view.width, canvasSize.height / view.height)}px`,
                    }}
                  />
                  1 m
                </div>
              </>
            )}
          </div>
          <footer className="editor-footer">
            <span>
              <span className="status-dot" /> {project.walls.length} 壁 <i />{" "}
              {project.items.length} オブジェクト
            </span>
            <span>
              単位：cm <i /> ローカル動作
            </span>
          </footer>
        </main>
        <aside
          id="details-panel"
          className="properties-panel"
          aria-label="寸法と表示設定"
          hidden={!detailsOpen}
          role={overlayPanels ? "dialog" : undefined}
          aria-modal={overlayPanels && detailsOpen ? true : undefined}
        >
          <div className="panel-heading">
            <div>
              <span className="eyebrow">DETAILS</span>
              <h2>{selection ? "選択中のアイテム" : "間取りの設定"}</h2>
            </div>
            <button
              className="icon-button"
              aria-label="設定パネルを閉じる"
              onClick={() => closePanel("details")}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          {selectedPointNote ? (
            <div className="property-content">
              <h3 className="section-label">この場所のメモ</h3>
              <label className="field">
                メモ
                <textarea
                  data-note-text
                  rows={5}
                  maxLength={200}
                  placeholder="例：窓下の高さ85 cm／ここに棚を置く"
                  value={selectedPointNote.text}
                  onChange={(e) =>
                    change((p) => {
                      p.notes.find((n) => n.id === selectedPointNote.id)!.text =
                        e.target.value;
                    })
                  }
                />
              </label>
              <p className="property-note">
                文字をドラッグすると、点を固定したままメモ部分だけを動かせます。点をドラッグすると全体が移動します。
              </p>
              <button
                className="wide-button"
                onClick={() =>
                  change((p) => {
                    delete p.notes.find((n) => n.id === selectedPointNote.id)!
                      .labelOffset;
                  })
                }
              >
                文字の位置を元に戻す
              </button>
              <button className="wide-button danger" onClick={remove}>
                <Icon name="trash" size={17} />
                メモを削除
              </button>
            </div>
          ) : selectedDimension ? (
            <div className="property-content">
              <h3 className="section-label">寸法メモ</h3>
              <p className="property-note">
                図面の長さ：
                {Number(
                  distance(selectedDimension.a, selectedDimension.b).toFixed(1),
                )}{" "}
                cm。実測値を登録しても壁や家具は動きません。
              </p>
              <NumberField
                key={`${selectedDimension.id}-value`}
                label="実測値"
                commitUnchanged
                value={
                  selectedDimension.value ??
                  distance(selectedDimension.a, selectedDimension.b)
                }
                unit="cm"
                min={0.1}
                max={20000}
                onChange={(v) =>
                  change((p) => {
                    p.dimensions.find(
                      (d) => d.id === selectedDimension.id,
                    )!.value = v;
                  })
                }
              />
              <p className="property-note">
                {selectedDimension.value === undefined
                  ? "実測値は未登録です。現在は図面から計算した値を表示しています。"
                  : "登録した実測値を表示しています。"}
              </p>
              <label className="field">
                メモ
                <textarea
                  rows={4}
                  maxLength={200}
                  placeholder="例：窓下の空間／通路幅を確保"
                  value={selectedDimension.note}
                  onChange={(e) =>
                    change((p) => {
                      p.dimensions.find(
                        (d) => d.id === selectedDimension.id,
                      )!.note = e.target.value;
                    })
                  }
                />
              </label>
              {selectedDimension.value !== undefined && (
                <button
                  className="wide-button"
                  onClick={() =>
                    change((p) => {
                      delete p.dimensions.find(
                        (d) => d.id === selectedDimension.id,
                      )!.value;
                    })
                  }
                >
                  実測値を消して図面の長さを表示
                </button>
              )}
              <p className="property-note">
                図面上でドラッグしてメモ全体を移動できます。2D専用のメモです。壁や家具を変更しても、この2点の位置は自動では変わりません。
              </p>
              <button className="wide-button danger" onClick={remove}>
                <Icon name="trash" size={17} />
                寸法メモを削除
              </button>
            </div>
          ) : selectedItem ? (
            <div className="property-content">
              <div className="selected-object">
                <div style={{ color: selectedItem.color }}>
                  <Icon
                    name={selectedItem.kind || selectedItem.shape}
                    size={35}
                  />
                </div>
                <span>
                  <small>{selectedItem.kind ? "建具・設備" : "家具"}</small>
                  <strong>{selectedItem.name}</strong>
                </span>
              </div>
              <label className="field">
                名称
                <input
                  value={selectedItem.name}
                  maxLength={80}
                  onChange={(e) => setItem("name", e.target.value)}
                />
              </label>
              <h3 className="section-label">
                {selectedWindow ? "窓のサイズ" : "サイズ"}
              </h3>
              <div className="dimension-fields">
                {[
                  ["width", "幅"],
                  ["depth", "奥行"],
                  ["height", "高さ"],
                ].map(([key, label]) => (
                  <NumberField
                    key={`${selectedItem.id}-${key}`}
                    label={
                      selectedWindow
                        ? ({
                            width: "窓の幅",
                            depth: "見込み",
                            height: "窓の高さ",
                          }[key] ?? label)
                        : label
                    }
                    value={selectedItem[key as "width"]}
                    unit="cm"
                    min={1}
                    max={20000}
                    onChange={(v) => setItem(key, v)}
                  />
                ))}
              </div>
              {selectedWindow && (
                <section
                  className="window-properties"
                  aria-label="窓の位置設定"
                >
                  <NumberField
                    key={`${selectedWindow.id}-sill`}
                    label="床から窓の下端まで"
                    value={windowElevation(selectedWindow)}
                    unit="cm"
                    min={0}
                    max={2000}
                    onChange={(v) => setItem("baseElevation", v)}
                  />
                  <h3 className="section-label">壁から窓の端まで（内寸）</h3>
                  {windowPlacement ? (
                    <>
                      <div className="dimension-fields two">
                        <NumberField
                          key={`${selectedWindow.id}-gap-a`}
                          label={windowPlacement.labelA}
                          value={windowPlacement.gapA}
                          unit="cm"
                          min={0}
                          max={20000}
                          onChange={(v) =>
                            change((p) =>
                              setOpeningGap(p, selectedWindow.id, "a", v),
                            )
                          }
                        />
                        <NumberField
                          key={`${selectedWindow.id}-gap-b`}
                          label={windowPlacement.labelB}
                          value={windowPlacement.gapB}
                          unit="cm"
                          min={0}
                          max={20000}
                          onChange={(v) =>
                            change((p) =>
                              setOpeningGap(p, selectedWindow.id, "b", v),
                            )
                          }
                        />
                      </div>
                      <p className="property-note">
                        壁の内側から窓の端までの距離です。窓の中心までではありません。片側を入力すると反対側も更新されます。幅の変更時は
                        {windowPlacement.labelA.replace("から", "")}
                        側の距離を保ちます。
                      </p>
                      <p className="property-note">
                        壁区間の内寸：
                        {Number(windowPlacement.available.toFixed(1))} cm ／
                        窓の上端：
                        {Number(
                          (
                            windowElevation(selectedWindow) +
                            selectedWindow.height
                          ).toFixed(1),
                        )}{" "}
                        cm
                      </p>
                      {(windowPlacement.gapA < -0.01 ||
                        windowPlacement.gapB < -0.01) && (
                        <p className="window-warning">
                          窓が壁区間をはみ出しています。幅または壁からの距離を調整してください。
                        </p>
                      )}
                      {windowElevation(selectedWindow) + selectedWindow.height >
                        windowPlacement.wall.height && (
                        <p className="window-warning">
                          窓の上端が壁の高さを超えています。窓の高さ・下端の位置、または壁の高さを確認してください。
                        </p>
                      )}
                      <p className="property-note">
                        途中で分かれた壁は、選択した窓がある壁区間を基準にします。図面のA・Bで測る端を確認できます。
                      </p>
                    </>
                  ) : (
                    <p className="property-note">
                      窓を壁の近くへドラッグして沿わせると、壁からの距離を入力できます。
                    </p>
                  )}
                </section>
              )}
              {(selectedItem.kind === "door" ||
                selectedItem.kind === "cabinetDoor") && (
                <>
                  <h3 className="section-label">ドアの開き方</h3>
                  <label className="field">
                    蝶番
                    <select
                      value={selectedItem.doorHinge ?? "left"}
                      onChange={(e) => setItem("doorHinge", e.target.value)}
                    >
                      <option value="left">左端</option>
                      <option value="right">右端</option>
                    </select>
                  </label>
                  <label className="field">
                    開く側
                    <select
                      value={selectedItem.doorSwing ?? "positive"}
                      onChange={(e) => setItem("doorSwing", e.target.value)}
                    >
                      <option value="positive">下側（回転前の図）</option>
                      <option value="negative">上側（回転前の図）</option>
                    </select>
                  </label>
                  <NumberField
                    label="開く角度"
                    value={selectedItem.doorAngle ?? 90}
                    min={0}
                    max={180}
                    unit="°"
                    onChange={(v) => setItem("doorAngle", v)}
                  />
                </>
              )}
              {selectedItem.shape === "shelf" && (
                <>
                  <h3 className="section-label">造作棚</h3>
                  <NumberField
                    label="段数"
                    value={selectedItem.shelfLevels ?? 4}
                    min={1}
                    max={20}
                    unit="段"
                    onChange={(v) => setItem("shelfLevels", Math.round(v))}
                  />
                  <NumberField
                    label="床からの高さ"
                    value={selectedItem.baseElevation ?? 0}
                    min={0}
                    max={2000}
                    unit="cm"
                    onChange={(v) => setItem("baseElevation", v)}
                  />
                </>
              )}
              {selectedItem.kind === "cabinetDoor" && (
                <NumberField
                  label="扉の下端の高さ"
                  value={selectedItem.baseElevation ?? 85}
                  unit="cm"
                  min={0}
                  max={2000}
                  onChange={(v) => setItem("baseElevation", v)}
                />
              )}
              {selectedItem.kind &&
                ["door", "sliding", "outlet"].includes(selectedItem.kind) && (
                  <>
                    <Toggle
                      label="壁へ自動で吸着"
                      checked={selectedItem.wallSnap !== false}
                      onChange={(value) =>
                        change((p) => {
                          p.items.find(
                            (i) => i.id === selectedItem.id,
                          )!.wallSnap = value;
                        })
                      }
                    />
                    <p className="property-note">
                      オフにすると、壁の近くでも位置・向きを自由に調整できます。壁の開口と寸法変更への追従も解除します。
                    </p>
                  </>
                )}
              <h3 className="section-label">位置・向き</h3>
              <div className="dimension-fields two">
                <NumberField
                  key={`${selectedItem.id}-x`}
                  label="X"
                  value={selectedItem.x}
                  unit="cm"
                  min={-50000}
                  max={50000}
                  onChange={(v) => setItem("x", v)}
                />
                <NumberField
                  key={`${selectedItem.id}-y`}
                  label="Y"
                  value={selectedItem.y}
                  unit="cm"
                  min={-50000}
                  max={50000}
                  onChange={(v) => setItem("y", v)}
                />
              </div>
              <NumberField
                key={`${selectedItem.id}-rotation`}
                label="角度"
                value={selectedItem.rotation}
                unit="°"
                min={-360}
                max={360}
                onChange={(v) => setItem("rotation", v)}
              />
              <button
                className="wide-button"
                onClick={() =>
                  setItem("rotation", (selectedItem.rotation + 90) % 360)
                }
              >
                <Icon name="rotate" size={17} />
                90°回転する <kbd>R</kbd>
              </button>
              <label className="field color-field">
                色
                <input
                  type="color"
                  value={selectedItem.color}
                  onChange={(e) => setItem("color", e.target.value)}
                />
              </label>
              {selectedItem.wallSnap !== false &&
                (selectedItem.kind === "sliding" ||
                  selectedItem.kind === "door") && (
                  <>
                    <button
                      className="wide-button"
                      onClick={() =>
                        change((p) => removeDoorLeaf(p, selectedItem.id))
                      }
                    >
                      建具だけ外して開口を残す
                    </button>
                    <p className="property-note">
                      扉を撤去し、隣の部屋につながる開口を残します。幅と高さはそのまま使えます。
                    </p>
                  </>
                )}
              {selectedItem.kind === "opening" && (
                <p className="property-note">
                  建具がない開口です。2D・3Dともこの幅でつながります。削除すると壁に戻ります。
                </p>
              )}
              <div className="object-actions">
                <button
                  onClick={() =>
                    change((p) =>
                      p.items.push({
                        ...selectedItem,
                        id: `i${p.nextId++}`,
                        x: selectedItem.x + 30,
                        y: selectedItem.y + 30,
                      }),
                    )
                  }
                >
                  <Icon name="copy" size={17} />
                  複製
                </button>
                <button className="danger" onClick={remove}>
                  <Icon name="trash" size={17} />
                  {selectedItem.kind === "opening"
                    ? "開口を閉じる"
                    : (selectedItem.kind === "sliding" ||
                          selectedItem.kind === "door") &&
                        selectedItem.wallSnap !== false
                      ? "壁に戻す"
                      : "削除"}
                </button>
              </div>
              {selectedItem.kind &&
                ["door", "sliding", "opening", "window", "outlet"].includes(
                  selectedItem.kind,
                ) && (
                  <p className="property-note">
                    「壁へ自動で吸着」がオンのとき、壁の向きに沿って配置します。戸棚には「戸棚の扉」を使えます。
                  </p>
                )}
            </div>
          ) : selectedWall ? (
            <div className="property-content">
              <div className="selected-object">
                <Icon name="wall" size={32} />
                <span>
                  <small>構造</small>
                  <strong>壁の寸法</strong>
                </span>
              </div>
              <NumberField
                key={`${selectedWall.id}-length`}
                label="長さ（内寸）"
                value={
                  Math.round(wallInteriorLength(project, selectedWall) * 10) /
                  10
                }
                unit="cm"
                min={10}
                max={20000}
                onChange={(v) =>
                  change((p) => {
                    const room = roomList.find((r) => {
                      const m = interiorRoom(p, r);
                      return (
                        m.rectangular &&
                        r.points.some(
                          (pt) => distance(pt, selectedWall.a) < 0.1,
                        ) &&
                        r.points.some(
                          (pt) => distance(pt, selectedWall.b) < 0.1,
                        ) &&
                        Math.abs(
                          distance(selectedWall.a, selectedWall.b) -
                            (selectedWall.a.y === selectedWall.b.y
                              ? m.maxX - m.minX
                              : m.maxY - m.minY),
                        ) < 0.1
                      );
                    });
                    if (room)
                      resizeRoomInterior(
                        p,
                        room,
                        selectedWall.a.y === selectedWall.b.y ? "x" : "y",
                        v,
                      );
                    else {
                      const inset = wallInsets(p, selectedWall);
                      resizeWall(
                        p,
                        selectedWall.id,
                        v + inset.start + inset.end,
                      );
                    }
                  })
                }
              />
              <NumberField
                key={`${selectedWall.id}-dimensionOffset`}
                label="寸法線の表示位置"
                value={
                  wallDimensionLayout(project, selectedWall, roomList).offset
                }
                unit="cm"
                min={-2000}
                max={2000}
                onChange={(v) =>
                  change((p) => {
                    p.walls.find(
                      (w) => w.id === selectedWall.id,
                    )!.dimensionOffset = v;
                  })
                }
              />
              <p className="property-note">
                寸法の文字をドラッグして、壁の近くや反対側へ寄せられます。壁の位置や内寸は変わりません。
              </p>
              <button
                className="wide-button"
                onClick={() =>
                  change((p) => {
                    delete p.walls.find((w) => w.id === selectedWall.id)!
                      .dimensionOffset;
                  })
                }
              >
                寸法線の位置を自動に戻す
              </button>
              <NumberField
                key={`${selectedWall.id}-height`}
                label="壁の高さ"
                value={selectedWall.height}
                unit="cm"
                min={1}
                max={2000}
                onChange={(v) =>
                  change((p) => {
                    p.walls.find((w) => w.id === selectedWall.id)!.height = v;
                  })
                }
              />
              <NumberField
                key={`${selectedWall.id}-thickness`}
                label="壁の厚み"
                value={selectedWall.thickness}
                unit="cm"
                min={1}
                max={100}
                onChange={(v) =>
                  change((p) => {
                    p.walls.find((w) => w.id === selectedWall.id)!.thickness =
                      v;
                  })
                }
              />
              <p className="property-note">
                壁の内側同士の距離です。四角い部屋は部屋を選んで幅・奥行も入力できます。接続する壁も追従します。
              </p>
              <button className="wide-button danger" onClick={remove}>
                <Icon name="trash" size={17} />
                壁を削除
              </button>
            </div>
          ) : selectedRoom ? (
            <div className="property-content">
              <h3 className="section-label">部屋の設定</h3>
              <label className="field">
                部屋の名前
                <input
                  value={roomLabel(selectedRoom)?.name || ""}
                  placeholder="リビングなど"
                  maxLength={80}
                  onChange={(e) => renameRoom(e.target.value)}
                />
              </label>
              {interiorRoom(project, selectedRoom).rectangular ? (
                <div className="dimension-fields two">
                  <NumberField
                    label="内寸の幅"
                    value={interiorRoom(project, selectedRoom).width}
                    min={10}
                    max={20000}
                    unit="cm"
                    onChange={(v) =>
                      change((p) => resizeRoomInterior(p, selectedRoom, "x", v))
                    }
                  />
                  <NumberField
                    label="内寸の奥行"
                    value={interiorRoom(project, selectedRoom).depth}
                    min={10}
                    max={20000}
                    unit="cm"
                    onChange={(v) =>
                      change((p) => resizeRoomInterior(p, selectedRoom, "y", v))
                    }
                  />
                </div>
              ) : (
                <p className="property-note">
                  変形した部屋は各壁を選んで内寸を入力してください。
                </p>
              )}
              <p className="property-note">
                内寸は壁の内側から内側まで。右側・下側の壁と、それにつながる壁を移動します。隣の部屋の寸法も変わります。
              </p>
              <div className="room-summary">
                <span>床面積（内寸）</span>
                <strong>
                  {interiorRoom(project, selectedRoom).area.toFixed(2)}
                  <small> m²</small>
                </strong>
              </div>
              <label className="field color-field">
                床の色
                <input
                  type="color"
                  value={roomLabel(selectedRoom)?.color || "#eee9de"}
                  onChange={(e) => {
                    const color = e.target.value;
                    change((p) => {
                      let label = p.labels.find((l) =>
                        inside(l, selectedRoom.points),
                      );
                      if (!label) {
                        label = { ...selectedRoom.center, name: "部屋", color };
                        p.labels.push(label);
                      }
                      label.color = color;
                    });
                  }}
                />
              </label>
              <p className="property-note">
                面積は壁の厚みを差し引いた内寸で計算しています。
              </p>
            </div>
          ) : (
            <div className="property-content">
              <div className="room-summary">
                <span>合計床面積</span>
                <strong>
                  {totalArea.toFixed(1)}
                  <small> m²</small>
                </strong>
                <p>
                  {roomList.length} 部屋 ·{" "}
                  {project.items.filter((i) => !i.kind).length} 家具
                </p>
              </div>
              <div className="selection-guide">
                <Icon name="cursor" size={25} />
                <p>
                  壁・家具・部屋を選択すると
                  <br />
                  寸法や詳細を編集できます。
                </p>
              </div>
            </div>
          )}
          <div className="display-settings">
            <h3 className="section-label">表示オプション</h3>
            {mode === "2d" ? (
              <>
                <Toggle
                  label="グリッドを表示"
                  checked={grid}
                  onChange={setGrid}
                />
                <Toggle
                  label="移動を目盛りに合わせる"
                  checked={snapping}
                  onChange={setSnapping}
                />
                <Toggle
                  label="窓の寸法を常時表示"
                  checked={showWindowDimensions}
                  onChange={setShowWindowDimensions}
                />
                <Toggle
                  label="壁の寸法を表示"
                  checked={dimensions}
                  onChange={setDimensions}
                />
                <Toggle
                  label="家具を半透明にする"
                  checked={seeThrough}
                  onChange={setSeeThrough}
                />
                <Toggle
                  label="家具名を図面の外に表示"
                  checked={showFurnitureNames}
                  onChange={toggleFurnitureNames}
                />
              </>
            ) : (
              <Toggle
                label="壁を低くして内部を見る"
                checked={cutaway}
                onChange={setCutaway}
              />
            )}
          </div>
          <div className="quick-tip">
            <span className="eyebrow">LITTLE TIP</span>
            <h3>ぴったりを、見つけよう。</h3>
            <p>
              家具の実寸を登録すれば、
              <br />
              暮らしのイメージがぐっと具体的に。
            </p>
            <div className="tip-art">
              <Icon name="plant" size={35} />
              <Icon name="sofa" size={75} />
            </div>
          </div>
          <div className="project-options">
            <button onClick={() => newProject(false)}>
              <Icon name="plus" size={16} />
              新しい間取り
            </button>
            <button onClick={() => newProject(true)}>サンプルを開く</button>
            <button disabled={mode === "3d"} onClick={exportSvg}>
              <Icon name="download" size={16} />
              2D図面をSVG出力
            </button>
          </div>
        </aside>
      </div>
      {notice && (
        <div className={`toast ${blocked ? "persistent" : ""}`} role="status">
          <Icon name={blocked ? "help" : "check"} size={19} />
          <span>{notice}</span>
          <button aria-label="通知を閉じる" onClick={() => setNotice("")}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {furnitureEditor && (
        <FurnitureModal
          furniture={furnitureEditor}
          onClose={() => setFurnitureEditor(null)}
          onSave={(f) => {
            change((p) => {
              if (!f.id) {
                f.id = `f${p.nextId++}`;
                p.furniture.push(f);
              } else {
                const index = p.furniture.findIndex((x) => x.id === f.id);
                p.furniture[index] = f;
                for (const i of p.items.filter((i) => i.furnitureId === f.id))
                  Object.assign(i, {
                    name: f.name,
                    width: f.width,
                    depth: f.depth,
                    height: f.height,
                    color: f.color,
                    shape: f.shape,
                    shelfLevels: f.shelfLevels,
                    baseElevation: f.baseElevation,
                  });
              }
            });
            setFurnitureEditor(null);
            setNotice(
              "家具を登録しました。配置済みの家具にも寸法を反映しました。",
            );
          }}
          onDelete={
            furnitureEditor.id
              ? () => {
                  if (
                    !window.confirm("この家具を一覧と間取りから削除しますか？")
                  )
                    return;
                  change((p) => {
                    p.furniture = p.furniture.filter(
                      (f) => f.id !== furnitureEditor.id,
                    );
                    p.items = p.items.filter(
                      (i) => i.furnitureId !== furnitureEditor.id,
                    );
                  });
                  setFurnitureEditor(null);
                  setSelection(null);
                }
              : undefined
          }
        />
      )}
      {printPreview && (
        <PrintPreview {...printPreview} onClose={closePrintPreview} />
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="閉じる"
              onClick={() => setHelp(false)}
            >
              <Icon name="close" />
            </button>
            <span className="eyebrow">WELCOME TO MADORI</span>
            <h2 id="help-title">暮らしを描く、基本の操作。</h2>
            <ol>
              <li>
                <strong>壁を描く</strong>
                <p>
                  「新しい間取り」から、壁ツールでドラッグ。端点同士をつないで囲むと部屋になります。
                </p>
              </li>
              <li>
                <strong>あとから寸法を入力</strong>
                <p>
                  選択ツールで壁をクリックし、右側の長さを指定。部屋をクリックすると名前も付けられます。
                </p>
              </li>
              <li>
                <strong>家具と設備を置く</strong>
                <p>
                  家具の幅・奥行・高さを登録し「配置する」。ドラッグで移動、Rで回転。移動バーで縦横の方向固定と1
                  mm・1 cm・10
                  cmの微調整ができます。矢印キーでも移動、Shift＋矢印で10倍。ドアや窓は壁の近くに配置します。
                </p>
              </li>
              <li>
                <strong>寸法メモと家具の表示</strong>
                <p>
                  メモ（N）で好きな1か所をクリックし、寸法や覚え書きを登録。「透過」で家具を半透明に、「家具名」で図面外への引き出し表示を切り替えます。窓寸法は常時表示できます。
                </p>
              </li>
              <li>
                <strong>図面を広く使う</strong>
                <p>
                  「広く使う」またはFキーでヘッダーとパネルを隠します。家具・設定は上のボタンで開けます。通常表示へ戻すには同じボタン、Fキー、またはEscキー。スマホでは必要なパネルだけ開き、配置したら図面へ戻ります。
                </p>
              </li>
              <li>
                <strong>3Dで確かめる</strong>
                <p>
                  3Dで回転・拡大して配置を確認。保存ボタンのJSONは別の端末で読み込めます。2Dの「PNG」「A4印刷」で図面を画像保存・印刷できます。
                </p>
              </li>
            </ol>
            <p className="property-note">
              右ドラッグ：画面移動 / ホイール：拡大縮小 / Ctrl＋Z：元に戻す /
              Delete：削除。図面は配置検討用です。内寸と内寸面積を表示します。
            </p>
            <button className="primary-button" onClick={() => setHelp(false)}>
              はじめる
              <Icon name="chevron" size={17} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" />
    </label>
  );
}
function NumberField({
  label,
  value,
  unit,
  min,
  max,
  onChange,
  commitUnchanged = false,
}: {
  label: string;
  commitUnchanged?: boolean;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }
    const n = Number(draft);
    if (
      draft !== null &&
      draft.trim() !== "" &&
      Number.isFinite(n) &&
      n >= min &&
      n <= max &&
      (n !== value || commitUnchanged)
    )
      onChange(n);
    setDraft(null);
  };
  return (
    <label className="field number-field">
      {label}
      <span>
        <input
          type="number"
          min={min}
          max={max}
          step="any"
          value={draft ?? Math.round(value * 100) / 100}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              cancelled.current = true;
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
        />
        <small>{unit}</small>
      </span>
    </label>
  );
}
function FurnitureModal({
  furniture,
  onClose,
  onSave,
  onDelete,
}: {
  furniture: Furniture;
  onClose: () => void;
  onSave: (f: Furniture) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState({ ...furniture });
  const set = (key: string, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal furniture-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="furniture-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return;
          onSave({ ...form, name: form.name.trim() });
        }}
      >
        <button
          type="button"
          className="modal-close icon-button"
          aria-label="閉じる"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        <span className="eyebrow">MAKE IT YOURS</span>
        <h2 id="furniture-title">
          {form.id ? "家具を編集" : "わたしの家具をつくる"}
        </h2>
        <p>実際のサイズを登録して、ぴったりの場所へ。</p>
        <div className="modal-preview" style={{ color: form.color }}>
          <Icon name={form.shape} size={80} />
        </div>
        <label className="field">
          家具の名称
          <input
            autoFocus
            required
            maxLength={80}
            placeholder="例：リビングのソファ"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <div className="dimension-fields two">
          <label className="field">
            分類
            <input
              required
              list="furniture-categories"
              maxLength={40}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            />
            <datalist id="furniture-categories">
              {["ソファ", "ベッド", "テーブル", "収納", "家電", "その他"].map(
                (c) => (
                  <option key={c} value={c} />
                ),
              )}
            </datalist>
          </label>
          <label className="field">
            形状
            <select
              value={form.shape}
              onChange={(e) => set("shape", e.target.value as Shape)}
            >
              {[
                ["generic", "シンプル"],
                ["sofa", "ソファ"],
                ["bed", "ベッド"],
                ["table", "テーブル"],
                ["storage", "収納"],
                ["shelf", "造作棚"],
                ["appliance", "家電"],
                ["plant", "植物"],
              ].map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="dimension-fields">
          {[
            ["width", "幅"],
            ["depth", "奥行"],
            ["height", "高さ"],
          ].map(([key, label]) => (
            <label className="field number-field" key={key}>
              {label}
              <span>
                <input
                  required
                  type="number"
                  min="1"
                  max="20000"
                  step="0.1"
                  value={form[key as "width"] || ""}
                  onChange={(e) => set(key, Number(e.target.value))}
                />
                <small>cm</small>
              </span>
            </label>
          ))}
        </div>
        {form.shape === "shelf" && (
          <div className="dimension-fields two">
            <label className="field">
              段数
              <input
                type="number"
                required
                min="1"
                max="20"
                step="1"
                value={form.shelfLevels ?? 4}
                onChange={(e) => set("shelfLevels", Number(e.target.value))}
              />
            </label>
            <label className="field">
              床からの高さ（cm）
              <input
                type="number"
                required
                min="0"
                max="2000"
                step="0.1"
                value={form.baseElevation ?? 0}
                onChange={(e) => set("baseElevation", Number(e.target.value))}
              />
            </label>
          </div>
        )}
        <label className="field color-field">
          色
          <input
            type="color"
            value={form.color}
            onChange={(e) => set("color", e.target.value)}
          />
        </label>
        <div className="modal-actions">
          {onDelete && (
            <button
              type="button"
              className="quiet-button danger"
              onClick={onDelete}
            >
              <Icon name="trash" size={17} />
              削除
            </button>
          )}
          <button type="button" className="quiet-button" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="primary-button">
            <Icon name="check" size={18} />
            {form.id ? "変更を保存" : "家具を登録"}
          </button>
        </div>
      </form>
    </div>
  );
}
