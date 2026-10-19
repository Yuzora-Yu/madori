import type { Item } from "../../packages/floorplan/model";

export default function ItemDimensions({ item }: { item: Item }) {
  const w = item.width / 2,
    d = item.depth / 2;
  const cm = (value: number) => `${Number(value.toFixed(1))} cm`;
  return (
    <g
      data-item-dimensions={item.id}
      pointerEvents="none"
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}
      fill="#2d634b"
      stroke="#2d634b"
      strokeWidth="1.3"
    >
      <path
        d={`M${-w} ${-d} V${-d - 22} M${w} ${-d} V${-d - 22} M${-w} ${-d - 17} H${w} M${w} ${-d} H${w + 22} M${w} ${d} H${w + 22} M${w + 17} ${-d} V${d}`}
        fill="none"
      />
      <g stroke="#f7f7f2" strokeWidth="5" paintOrder="stroke" fontSize="12">
        <text x="0" y={-d - 24} textAnchor="middle">
          幅 {cm(item.width)}
        </text>
        <text x={w + 25} y="4">
          {item.kind === "outlet" ? "プレート高さ" : "奥行"} {cm(item.depth)}
        </text>
        <text x="0" y={d + 25} textAnchor="middle">
          {item.kind === "outlet" ? "床から" : "高さ"} {cm(item.height)}
        </text>
      </g>
    </g>
  );
}
