import { doorPose } from "../../packages/floorplan/geometry";
import type { Item } from "../../packages/floorplan/model";
export default function PlanItem({
  item: i,
  selected,
  onPointerDown,
}: {
  item: Item;
  selected: boolean;
  onPointerDown: React.PointerEventHandler<SVGGElement>;
}) {
  const w = i.width,
    d = i.depth;
  const pose = doorPose(i);
  return (
    <g
      transform={`translate(${i.x} ${i.y}) rotate(${i.rotation})`}
      onPointerDown={onPointerDown}
      className="plan-item"
      role="button"
      aria-label={i.name}
    >
      <title>
        {i.name} · {w} × {d} × {i.height} cm
      </title>
      {selected && (
        <rect
          x={-w / 2 - 7}
          y={-d / 2 - 7}
          width={w + 14}
          height={d + 14}
          rx="4"
          fill="none"
          stroke="#32795d"
          strokeWidth="2"
          strokeDasharray="5 4"
        />
      )}
      {i.kind === "door" ? (
        <g fill="none" stroke="#87785f" strokeWidth="2">
          <path
            d={`M${-w / 2} 0 H${w / 2}`}
            stroke="#f7f5ee"
            strokeWidth="16"
          />
          <path
            d={`M${pose.hinge.x} 0 L${pose.tip.x} ${pose.tip.y} ${(i.doorAngle ?? 90) > 0 ? `M${pose.closed.x} 0 A${w} ${w} 0 0 ${pose.sweep} ${pose.tip.x} ${pose.tip.y}` : ""}`}
          />
          <circle cx={pose.hinge.x} cy="0" r="3" fill="#87785f" />
        </g>
      ) : i.kind === "sliding" ? (
        <g>
          <rect x={-w / 2} y="-7" width={w} height="14" fill="#f7f5ee" />
          <path
            d={`M${-w / 2} -3 h${w / 2} M0 3 h${w / 2}`}
            stroke="#a58c6b"
            strokeWidth="4"
          />
          <path
            d={`M${-w / 4} -18 h${w / 2} l-6 -4 m6 4 l-6 4`}
            fill="none"
            stroke="#a58c6b"
            strokeWidth="1.5"
          />
        </g>
      ) : i.kind === "window" ? (
        <g>
          <rect
            x={-w / 2}
            y="-6"
            width={w}
            height="12"
            fill="#e0eff0"
            stroke="#6c9ba3"
            strokeWidth="2"
          />
          <path
            d={`M${-w / 2} 0 h${w} M0 -6 v12`}
            stroke="#6c9ba3"
            strokeWidth="1.5"
          />
        </g>
      ) : i.kind === "outlet" ? (
        <g>
          <circle r="13" fill="#fff7de" stroke="#a08953" strokeWidth="1.5" />
          <path d="M-4 -4v7 M4 -4v7" stroke="#a08953" strokeWidth="2" />
        </g>
      ) : (
        <g fill={i.color} stroke="#6c776b" strokeWidth="1.3">
          {i.shape === "plant" ? (
            <>
              <circle r={w / 2} fill="#dee6d6" />
              <path
                d={`M0 ${-d * 0.4} Q${w * 0.6} 0 0 ${d * 0.4} Q${-w * 0.6} 0 0 ${-d * 0.4} M${-w * 0.4} 0 Q0 ${-d * 0.6} ${w * 0.4} 0 Q0 ${d * 0.6} ${-w * 0.4} 0`}
                fill={i.color}
              />
              <circle r="5" />
            </>
          ) : (
            <>
              <rect
                x={-w / 2}
                y={-d / 2}
                width={w}
                height={d}
                rx={i.kind === "toilet" ? w / 2 : 5}
              />
              {i.shape === "sofa" && (
                <>
                  <rect
                    x={-w / 2 + 12}
                    y={-d / 2 + 17}
                    width={w - 24}
                    height={d - 25}
                    rx="7"
                    fill="#ffffff35"
                  />
                  <path d={`M0 ${-d / 2 + 17} v${d - 25}`} />
                  <rect x={-w / 2} y={-d / 2} width="12" height={d} rx="4" />
                  <rect
                    x={w / 2 - 12}
                    y={-d / 2}
                    width="12"
                    height={d}
                    rx="4"
                  />
                  <rect x={-w / 2} y={-d / 2} width={w} height="16" rx="4" />
                </>
              )}
              {i.shape === "bed" && (
                <>
                  <rect
                    x={-w / 2 + 5}
                    y={-d / 2 + 5}
                    width={w - 10}
                    height={d - 10}
                    rx="4"
                    fill="#f8f5ed"
                  />
                  <rect
                    x={-w / 2 + 5}
                    y={-d * 0.1}
                    width={w - 10}
                    height={d * 0.57}
                    fill={i.color}
                    stroke="none"
                  />
                  <rect
                    x={-w / 2 + 10}
                    y={-d / 2 + 10}
                    width={w / 2 - 15}
                    height={d * 0.18}
                    rx="5"
                  />
                  <rect
                    x="5"
                    y={-d / 2 + 10}
                    width={w / 2 - 15}
                    height={d * 0.18}
                    rx="5"
                  />
                </>
              )}
              {i.shape === "table" && (
                <rect
                  x={-w / 2 + 5}
                  y={-d / 2 + 5}
                  width={w - 10}
                  height={d - 10}
                  rx="3"
                  fill="none"
                  stroke="#ffffff55"
                />
              )}
              {i.shape === "shelf" && (
                <>
                  <path
                    d={`M${-w / 2 + 3} ${-d / 2 + 3} h${w - 6} M${-w / 2 + 3} ${-d / 2 + 3} v${d - 6} M${w / 2 - 3} ${-d / 2 + 3} v${d - 6}`}
                    strokeWidth="3"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    stroke="none"
                    fill="#475846"
                    fontSize="12"
                  >
                    {i.shelfLevels ?? 4}段
                  </text>
                </>
              )}
              {i.shape === "storage" && (
                <path d={`M0 ${-d / 2} v${d} M-9 -3v6 M9 -3v6`} />
              )}
              {i.shape === "appliance" && (
                <path
                  d={`M${-w / 2} ${-d * 0.15} h${w} M${-w * 0.3} ${-d * 0.35} v${d * 0.12}`}
                />
              )}
              {i.kind === "bath" && (
                <rect
                  x={-w / 2 + 8}
                  y={-d / 2 + 8}
                  width={w - 16}
                  height={d - 16}
                  rx="22"
                  fill="#e8f2f1"
                />
              )}
              {i.kind === "toilet" && (
                <>
                  <rect
                    x={-w / 2}
                    y={-d / 2}
                    width={w}
                    height={d * 0.3}
                    rx="3"
                    fill="#f6faf7"
                  />
                  <ellipse
                    cx="0"
                    cy={d * 0.1}
                    rx={w * 0.35}
                    ry={d * 0.24}
                    fill="#f6faf7"
                  />
                </>
              )}
            </>
          )}
        </g>
      )}
    </g>
  );
}
