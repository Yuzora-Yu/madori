import type { wallDimensionLayout } from "../../packages/floorplan/annotations";
export default function WallDimension({
  entry,
  selected,
  onPointerDown,
}: {
  entry: ReturnType<typeof wallDimensionLayout>;
  selected: boolean;
  onPointerDown: React.PointerEventHandler<SVGGElement>;
}) {
  const { a, b, label, value } = entry;
  return (
    <g>
      <path
        className="dim-line"
        pointerEvents="none"
        d={`M${a.x} ${a.y} L${b.x} ${b.y} M${a.x - 3} ${a.y - 3} l6 6 M${b.x - 3} ${b.y - 3} l6 6`}
      />
      <g
        className="wall-dimension-label"
        role="button"
        aria-label={`壁の寸法 ${value} cm 内寸`}
        onPointerDown={onPointerDown}
      >
        <title>
          ドラッグで寸法線の表示位置だけを動かせます。壁や長さは変わりません。
        </title>
        <rect
          x={label.x - 55}
          y={label.y - 14}
          width="110"
          height="22"
          fill="transparent"
          data-editor-only="wall-dimension-hit"
        />
        {selected && (
          <rect
            data-editor-only="wall-dimension-selection"
            x={label.x - 55}
            y={label.y - 14}
            width="110"
            height="22"
            rx="3"
            stroke="#32795d"
            fill="none"
            strokeDasharray="3 3"
          />
        )}
        <text className="dim-label" textAnchor="middle" x={label.x} y={label.y}>
          {value} cm 内寸
        </text>
      </g>
    </g>
  );
}
