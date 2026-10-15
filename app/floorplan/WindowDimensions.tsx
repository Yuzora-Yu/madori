import type { Item } from "../../packages/floorplan/model";
import type { openingPlacement } from "../../packages/floorplan/geometry";
export default function WindowDimensions({
  item,
  placement: m,
  offset = 58,
  selected = false,
  editorOnly = false,
}: {
  item: Item;
  offset?: number;
  selected?: boolean;
  editorOnly?: boolean;
  placement: NonNullable<ReturnType<typeof openingPlacement>>;
}) {
  const angle = (Math.atan2(m.uy, m.ux) * 180) / Math.PI;
  const a = m.insetA,
    b = m.length - m.insetB,
    left = m.center - item.width / 2,
    right = m.center + item.width / 2;
  const segments = [
    { start: a, end: left, text: `${Number(m.gapA.toFixed(1))} cm` },
    { start: left, end: right, text: `幅 ${Number(item.width.toFixed(1))} cm` },
    { start: right, end: b, text: `${Number(m.gapB.toFixed(1))} cm` },
  ];
  return (
    <g
      data-editor-only={editorOnly ? "window-dimensions" : undefined}
      data-window-dimensions={item.id}
      pointerEvents="none"
      transform={`translate(${m.start.x} ${m.start.y}) rotate(${angle})`}
      fill="#2d634b"
      stroke="#2d634b"
      strokeWidth="1.5"
    >
      {segments.map((s, i) => (
        <g key={i}>
          <path
            d={`M${s.start} 16 V${offset + 8} M${s.end} 16 V${offset + 8} M${s.start} ${offset} H${s.end}`}
            fill="none"
          />
          <text
            x={(s.start + s.end) / 2}
            y={offset - 7}
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
      <text
        x={m.center}
        y={offset + 20}
        textAnchor="middle"
        stroke="#f7f7f2"
        strokeWidth="5"
        paintOrder="stroke"
        fontSize="12"
      >
        高さ {Number(item.height.toFixed(1))} cm
      </text>
      {selected && (
        <g data-editor-only="window-end-markers">
          {[
            { x: a, label: "A" },
            { x: b, label: "B" },
          ].map((p) => (
            <g key={p.label}>
              <circle cx={p.x} cy={offset + 40} r="10" fill="#2d634b" />
              <text
                x={p.x}
                y={offset + 44}
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
      )}
    </g>
  );
}
