import { distance, type DimensionNote } from "../../packages/floorplan/model";
export default function DimensionMemo({
  entry: d,
  selected,
  onPointerDown,
}: {
  entry: DimensionNote;
  selected: boolean;
  onPointerDown?: React.PointerEventHandler<SVGGElement>;
}) {
  const length = distance(d.a, d.b),
    ux = (d.b.x - d.a.x) / (length || 1),
    uy = (d.b.y - d.a.y) / (length || 1),
    mx = (d.a.x + d.b.x) / 2,
    my = (d.a.y + d.b.y) / 2;
  const color = selected ? "#2d634b" : "#53788c";
  return (
    <g
      className="dimension-memo"
      role={onPointerDown ? "button" : undefined}
      aria-label={onPointerDown ? `寸法メモ ${d.note || d.id}` : undefined}
      onPointerDown={onPointerDown}
      pointerEvents={onPointerDown ? undefined : "none"}
    >
      <title>
        {d.note || "寸法メモ"} ·{" "}
        {d.value === undefined ? "図面から計算" : "実測値"}{" "}
        {Number((d.value ?? length).toFixed(1))} cm
      </title>
      {onPointerDown && (
        <line
          x1={d.a.x}
          y1={d.a.y}
          x2={d.b.x}
          y2={d.b.y}
          stroke="transparent"
          strokeWidth="22"
        />
      )}
      <g fill="none" stroke={color} strokeWidth={selected ? 2.5 : 1.5}>
        <line x1={d.a.x} y1={d.a.y} x2={d.b.x} y2={d.b.y} />
        {[d.a, d.b].map((p, i) => (
          <path
            key={i}
            d={`M${p.x - uy * 7} ${p.y + ux * 7} L${p.x + uy * 7} ${p.y - ux * 7}`}
          />
        ))}
      </g>
      <g
        textAnchor="middle"
        fill={color}
        stroke="#f7f7f2"
        strokeWidth="5"
        paintOrder="stroke"
        fontSize="13"
      >
        <text x={mx} y={my - 10}>
          {d.value === undefined ? "図上" : "実測"}{" "}
          {Number((d.value ?? length).toFixed(1))} cm
        </text>
        {d.note && (
          <text x={mx} y={my + 16} fontSize="12">
            {d.note.length > 32 ? d.note.slice(0, 32) + "…" : d.note}
          </text>
        )}
      </g>
      {selected && (
        <g
          data-editor-only="dimension-handles"
          fill="white"
          stroke={color}
          strokeWidth="2"
        >
          {[d.a, d.b].map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" />
          ))}
        </g>
      )}
    </g>
  );
}
