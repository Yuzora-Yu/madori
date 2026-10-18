import type { PointNote } from "../../packages/floorplan/model";
export default function PointMemo({
  entry: n,
  selected,
  onPointerDown,
}: {
  entry: PointNote;
  selected: boolean;
  onPointerDown: (
    event: React.PointerEvent<SVGGElement>,
    part: "label" | "anchor",
  ) => void;
}) {
  const label = n.text || "メモを入力",
    text = label.length > 28 ? label.slice(0, 28) + "…" : label;
  const width = Math.max(
    110,
    Array.from(text).reduce((w, c) => w + (c.charCodeAt(0) > 127 ? 13 : 7), 20),
  );
  const x = n.labelOffset?.x ?? 16,
    y = n.labelOffset?.y ?? -34;
  const end = {
    x: Math.max(x, Math.min(x + width, 0)),
    y: Math.max(y, Math.min(y + 28, 0)),
  };
  return (
    <g className="point-memo" transform={`translate(${n.x} ${n.y})`}>
      <path
        d={`M0 0 L${end.x} ${end.y}`}
        stroke="#9a793f"
        fill="none"
        strokeWidth="1.5"
        pointerEvents="none"
      />
      <g
        role="button"
        aria-label={`メモの点 ${label}`}
        onPointerDown={(e) => onPointerDown(e, "anchor")}
        className="memo-anchor"
      >
        <title>点をドラッグすると、メモの位置全体を移動します。</title>
        <circle r="12" fill="transparent" data-editor-only="memo-hit-area" />
        <circle r="5" fill="#a17c38" stroke="white" strokeWidth="2" />
      </g>
      <g
        role="button"
        aria-label={`メモ ${label}`}
        onPointerDown={(e) => onPointerDown(e, "label")}
        className="memo-label"
      >
        <title>
          {label} ·
          文字をドラッグすると、点を固定したまま表示位置だけ動かせます。
        </title>
        <rect
          x={x}
          y={y}
          width={width}
          height="28"
          rx="5"
          fill="#fff9e8"
          stroke={selected ? "#32795d" : "#bca46e"}
          strokeWidth={selected ? 2 : 1}
        />
        <text x={x + 10} y={y + 19} fontSize="13" fill="#625233">
          {text}
        </text>
      </g>
    </g>
  );
}
