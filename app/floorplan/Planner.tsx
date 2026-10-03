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
const Scene3D = lazy(() => import("./Scene3D"));
type Tool = "select" | "wall" | "pan" | FixtureKind;
type Selection =
  | { type: "item" | "wall"; id: string }
  | { type: "room"; index: number }
  | null;
type View = { x: number; y: number; width: number; height: number };
type Gesture =
  | { type: "item"; before: Project; id: string; offset: Point }
  | { type: "wall"; start: Point }
  | { type: "pan"; screen: Point; view: View; scale: number };
const toolList: { id: Tool; icon: IconName; label: string; key?: string }[] = [
  { id: "select", icon: "cursor", label: "選択", key: "V" },
  { id: "wall", icon: "wall", label: "壁を描く", key: "W" },
  { id: "door", icon: "door", label: "ドア" },
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
  const [selection, setSelection] = useState<Selection>(null);
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [grid, setGrid] = useState(true),
    [snapping, setSnapping] = useState(true),
    [dimensions, setDimensions] = useState(true),
    [cutaway, setCutaway] = useState(true);
  const [view, setView] = useState<View>({
    x: -120,
    y: -120,
    width: 1140,
    height: 890,
  });
  const [canvasSize, setCanvasSize] = useState({ width: 700, height: 450 });
  const [draft, setDraft] = useState<{ a: Point; b: Point } | null>(null);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("すべて");
  const [tab, setTab] = useState<"furniture" | "fixtures">("furniture");
  const [furnitureEditor, setFurnitureEditor] = useState<Furniture | null>(
    null,
  );
  const [help, setHelp] = useState(false);
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
      edit(next);
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
      if (selection.type === "item")
        p.items = p.items.filter((i) => i.id !== selection.id);
      else if (selection.type === "wall")
        p.walls = p.walls.filter((w) => w.id !== selection.id);
    });
    setSelection(null);
  }, [selection, change]);
  const fit = useCallback(() => {
    const b = bounds(project),
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
  }, [project]);
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
    const observer = new ResizeObserver(() =>
      setCanvasSize({ width: el.clientWidth, height: el.clientHeight }),
    );
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
      if (furnitureEditor || help) return;
      if (
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
      )
        return;
      if (e.key === "Escape") {
        const g = gesture.current;
        if (g?.type === "item") setProject(g.before);
        gesture.current = null;
        setDraft(null);
        setTool("select");
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
      if (e.key.toLowerCase() === "v") setTool("select");
      if (e.key.toLowerCase() === "w") setTool("wall");
      if (e.key.toLowerCase() === "r" && selectedItem)
        change((p) => {
          p.items.find((i) => i.id === selectedItem.id)!.rotation =
            (selectedItem.rotation + 90) % 360;
        });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, remove, selectedItem, change, furnitureEditor, help]);
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
    if (e.button !== 0 && e.button !== 1) return;
    const point = snapped(world(e));
    svg.current?.setPointerCapture(e.pointerId);
    if (e.button === 1 || tool === "pan" || e.altKey) {
      const m = svg.current?.getScreenCTM();
      gesture.current = {
        type: "pan",
        screen: { x: e.clientX, y: e.clientY },
        view,
        scale: m?.a || 1,
      };
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
      setTool("select");
      return;
    }
    setSelection(null);
  }
  function pointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
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
    if (g.type === "item") {
      const pt = world(e),
        p = {
          ...g.before,
          items: g.before.items.map((i) => (i.id === g.id ? { ...i } : i)),
        },
        item = p.items.find((i) => i.id === g.id)!;
      moveItem(
        p,
        item,
        snapped({ x: pt.x - g.offset.x, y: pt.y - g.offset.y }),
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
      g?.type === "item" &&
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
    setTool("select");
    setMode("2d");
    setNotice(`${f.name}を配置しました。ドラッグで位置を調整できます。`);
  }
  function setItem(key: string, value: string | number) {
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
    setTool(demo ? "select" : "wall");
  }
  function exportSvg() {
    if (!svg.current) return;
    const copy = svg.current.cloneNode(true) as SVGSVGElement;
    const b = bounds(project);
    copy.setAttribute("viewBox", `${b.x} ${b.y} ${b.width} ${b.height}`);
    copy.setAttribute("width", String(b.width));
    copy.setAttribute("height", String(b.height));
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const style = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "style",
    );
    style.textContent =
      ".room-name{font:500 15px sans-serif;fill:#596957}.room-area{font:12px sans-serif;fill:#7c8478}.dim-label{font:12px sans-serif;fill:#6e766a;paint-order:stroke;stroke:#f7f5ee;stroke-width:6}.dim-line{stroke:#a6ab9d;stroke-width:1}";
    copy.prepend(style);
    download(
      new Blob([new XMLSerializer().serializeToString(copy)], {
        type: "image/svg+xml",
      }),
      `${project.name}.svg`,
    );
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
  const totalArea = roomList.reduce((sum, r) => sum + r.area, 0);
  return (
    <div className="planner">
      <header className="app-header">
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
              <button disabled={mode === "3d"} onClick={exportSvg}>
                <Icon name="download" size={16} />
                2D図面をSVG出力
              </button>
            </div>
          </details>
          <button
            className="quiet-button"
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
        <aside className="library-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">YOUR COLLECTION</span>
              <h2>家具と設備</h2>
            </div>
            <span className="collection-count">{project.furniture.length}</span>
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
                    setTool(kind);
                    setMode("2d");
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
            <div>
              <span className="eyebrow">FLOOR PLAN</span>
              <h1>間取りをデザイン</h1>
            </div>
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
                  setTool("select");
                }}
              >
                <Icon name="box" size={17} />
                3D
              </button>
            </div>
          </div>
          <div className="toolbar">
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
                    setTool(t.id);
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
          <div className={`canvas-wrap tool-${tool}`}>
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
                  if (g?.type === "item") setProject(g.before);
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
                      <text
                        x={r.center.x}
                        y={r.center.y - 4}
                        textAnchor="middle"
                        className="room-name"
                      >
                        {label?.name || `部屋 ${index + 1}`}
                      </text>
                      <text
                        x={r.center.x}
                        y={r.center.y + 16}
                        textAnchor="middle"
                        className="room-area"
                      >
                        {r.area.toFixed(1)} m²
                      </text>
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
                {dimensions &&
                  project.walls.map((w) => {
                    const length = distance(w.a, w.b),
                      dx = w.b.x - w.a.x,
                      dy = w.b.y - w.a.y;
                    const nx = (dy / length) * 26,
                      ny = (-dx / length) * 26;
                    return (
                      <g key={`dim-${w.id}`} pointerEvents="none">
                        <path
                          className="dim-line"
                          d={`M${w.a.x + nx} ${w.a.y + ny} L${w.b.x + nx} ${w.b.y + ny} M${w.a.x + nx - 3} ${w.a.y + ny - 3} l6 6 M${w.b.x + nx - 3} ${w.b.y + ny - 3} l6 6`}
                        />
                        <text
                          className="dim-label"
                          textAnchor="middle"
                          x={(w.a.x + w.b.x) / 2 + nx}
                          y={(w.a.y + w.b.y) / 2 + ny - 5}
                        >
                          {Math.round(length)} cm
                        </text>
                      </g>
                    );
                  })}
                {project.items.map((i) => (
                  <PlanItem
                    key={i.id}
                    item={i}
                    selected={selectedItem?.id === i.id}
                    onPointerDown={(e) => selectItem(e, i.id)}
                  />
                ))}
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
                    : tool === "select"
                      ? "家具をドラッグで移動 · Alt＋ドラッグで画面を移動"
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
                    onClick={() => setTool(tool === "pan" ? "select" : "pan")}
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
        <aside className="properties-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">DETAILS</span>
              <h2>{selection ? "選択中のアイテム" : "間取りの設定"}</h2>
            </div>
            <Icon
              name={
                selectedWall
                  ? "wall"
                  : selectedItem?.kind || selectedItem?.shape || "plan"
              }
              size={20}
            />
          </div>
          {selectedItem ? (
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
              <h3 className="section-label">サイズ</h3>
              <div className="dimension-fields">
                {[
                  ["width", "幅"],
                  ["depth", "奥行"],
                  ["height", "高さ"],
                ].map(([key, label]) => (
                  <NumberField
                    key={`${selectedItem.id}-${key}`}
                    label={label}
                    value={selectedItem[key as "width"]}
                    unit="cm"
                    min={1}
                    max={20000}
                    onChange={(v) => setItem(key, v)}
                  />
                ))}
              </div>
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
                  削除
                </button>
              </div>
              {selectedItem.kind &&
                ["door", "sliding", "window", "outlet"].includes(
                  selectedItem.kind,
                ) && (
                  <p className="property-note">
                    壁の近くへドラッグすると、壁の向きに沿って配置します。
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
                label="長さ（実寸を指定）"
                value={Math.round(distance(selectedWall.a, selectedWall.b))}
                unit="cm"
                min={10}
                max={20000}
                onChange={(v) =>
                  change((p) => resizeWall(p, selectedWall.id, v))
                }
              />
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
                手描きのあとで実寸を入力できます。始点を固定して終点を調整し、接続された壁も追従します。
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
              <div className="room-summary">
                <span>床面積</span>
                <strong>
                  {selectedRoom.area.toFixed(2)}
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
                面積は壁の中心線を基準に計算しています。
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
                  label="10 cmにスナップ"
                  checked={snapping}
                  onChange={setSnapping}
                />
                <Toggle
                  label="壁の寸法を表示"
                  checked={dimensions}
                  onChange={setDimensions}
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
            <h2 id="help-title">暮らしを描く、4つのステップ。</h2>
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
                  家具の幅・奥行・高さを登録し「配置する」。ドラッグで移動、Rで回転。ドアや窓は壁の近くに配置します。
                </p>
              </li>
              <li>
                <strong>3Dで確かめる</strong>
                <p>
                  3Dで回転・拡大して配置を確認。保存ボタンでJSONに書き出すと、別の端末でも読み込めます。
                </p>
              </li>
            </ol>
            <p className="property-note">
              Alt＋ドラッグ：画面移動 / ホイール：拡大縮小 / Ctrl＋Z：元に戻す /
              Delete：削除。図面は配置検討用です。壁芯面積を表示します。
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
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const n = Number(draft);
    if (
      draft !== null &&
      draft.trim() !== "" &&
      Number.isFinite(n) &&
      n >= min &&
      n <= max &&
      n !== value
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
