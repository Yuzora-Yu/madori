import type { PointNote } from "../../packages/floorplan/model";
export default function PointMemo({
  entry: n,
  selected,
  onPointerDown,
}: {
  entry: PointNote;
  selected: boolean;
  onPointerDown: React.PointerEventHandler<SVGGElement>;
}) {
  const label = n.text || "メモを入力",
    text = label.length > 28 ? label.slice(0, 28) + "…" : label,
    width = Math.max(
      110,
      Array.from(text).reduce(
        (w, c) => w + (c.charCodeAt(0) > 127 ? 13 : 7),
        20,
      ),
    );
  return (
    <g
      className="point-memo"
      role="button"
      aria-label={`メモ ${label}`}
      onPointerDown={onPointerDown}
      transform={`translate(${n.x} ${n.y})`}
    >
      <title>{label}</title>
      <path d="M0 0 L16 -20" stroke="#9a793f" fill="none" strokeWidth="1.5" />
      <circle r="5" fill="#a17c38" stroke="white" strokeWidth="2" />
      <rect
        x="16"
        y="-34"
        width={width}
        height="28"
        rx="5"
        fill="#fff9e8"
        stroke={selected ? "#32795d" : "#bca46e"}
        strokeWidth={selected ? 2 : 1}
      />
      <text x="26" y="-15" fontSize="13" fill="#625233">
        {text}
      </text>
    </g>
  );
}
