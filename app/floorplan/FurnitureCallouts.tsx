import type { furnitureCallouts } from "../../packages/floorplan/annotations";
export default function FurnitureCallouts({
  entries,
}: {
  entries: ReturnType<typeof furnitureCallouts>;
}) {
  return (
    <g className="furniture-callouts" pointerEvents="none">
      {entries.map((c) => (
        <g key={c.id}>
          <title>{c.name}</title>
          <path
            d={`M${c.anchor.x} ${c.anchor.y} L${c.elbow} ${c.y} H${c.side === "left" ? c.x + c.width : c.x}`}
            fill="none"
            stroke="#55737e"
            strokeWidth="1.2"
            opacity="0.8"
          />
          <circle cx={c.anchor.x} cy={c.anchor.y} r="3" fill="#55737e" />
          <rect
            x={c.x}
            y={c.y - 13}
            width={c.width}
            height="26"
            rx="5"
            fill="#ffffff"
            stroke="#bdccca"
          />
          <text x={c.x + 12} y={c.y + 4} fontSize="13" fill="#3f5b65">
            {c.text}
          </text>
        </g>
      ))}
    </g>
  );
}
