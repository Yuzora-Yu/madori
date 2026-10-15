import type { Item } from "../../packages/floorplan/model";
import type { openingPlacement } from "../../packages/floorplan/geometry";
export default function WindowDimensions({
  item,
  placement: m,
}: {
  item: Item;
  placement: NonNullable<ReturnType<typeof openingPlacement>>;
}) {
  const angle = (Math.atan2(m.uy, m.ux) * 180) / Math.PI;
  const a = m.insetA,
    b = m.length - m.insetB,
    left = m.center - item.width / 2,
    right = m.center + item.width / 2;
  const segments = [
    { start: a, end: left, text: `${Number(m.gapA.toFixed(1))} cm` },
    { start: left, end: right, text: `窓 ${Number(item.width.toFixed(1))} cm` },
    { start: right, end: b, text: `${Number(m.gapB.toFixed(1))} cm` },
  ];
  return (
    <g
      data-editor-only="window-dimensions"
      pointerEvents="none"
      transform={`translate(${m.start.x} ${m.start.y}) rotate(${angle})`}
      fill="#2d634b"
      stroke="#2d634b"
      strokeWidth="1.5"
    >
      {segments.map((s, i) => (
        <g key={i}>
          <path
            d={`M${s.start} 22 V66 M${s.end} 22 V66 M${s.start} 58 H${s.end}`}
            fill="none"
          />
          <text
            x={(s.start + s.end) / 2}
            y="51"
            textAnchor="middle"
            stroke="#f7f7f2"
            strokeWidth="5"
            paintOrder="stroke"
            fontSize="12"
          >
            {s.text}
          </text>
        </g>
      ))}
      {[
        { x: a, label: "A" },
        { x: b, label: "B" },
      ].map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy="80" r="10" fill="#2d634b" />
          <text
            x={p.x}
            y="84"
            textAnchor="middle"
            fill="white"
            stroke="none"
            fontSize="12"
          >
            {p.label}
          </text>
        </g>
      ))}
    </g>
  );
}
