import { useState } from "react";
import { useLayerStore } from "@/stores/layerStore";

function resolveColor(style: Record<string, unknown>): string {
  const c = style["fill-color"] ?? style["line-color"] ?? style["circle-color"] ?? "#888";
  if (typeof c === "string") return c;
  // match expression: ["match", ["get", prop], val1, color1, val2, color2, ..., default]
  if (Array.isArray(c) && c[0] === "match" && c.length >= 4) return c[3] as string;
  // interpolate expression: use fallback
  return "#888";
}

function resolveShape(style: Record<string, unknown>): "fill" | "line" | "circle" {
  if (style.type) return style.type as "fill" | "line" | "circle";
  if (style["fill-color"]) return "fill";
  if (style["circle-color"]) return "circle";
  return "line";
}

/** Expand match expression into sub-items: [{label, color}] */
function resolveMatchItems(
  style: Record<string, unknown>,
): { label: string; color: string }[] | null {
  const c = style["fill-color"] ?? style["line-color"] ?? style["circle-color"];
  if (!Array.isArray(c) || c[0] !== "match" || c.length < 6) return null;
  // ["match", ["get", prop], val1, color1, val2, color2, ..., defaultColor]
  const items: { label: string; color: string }[] = [];
  for (let i = 2; i < c.length - 1; i += 2) {
    items.push({ label: String(c[i]), color: c[i + 1] as string });
  }
  return items.length > 0 ? items : null;
}

const TYPE_LABELS: Record<string, string> = {
  PIPE_SEW: "하수관로",
  PIPE_RAIN: "우수관로",
  PIPE_COMBINED: "합류관로",
  PIPE_TREATMENT: "처리관로",
  MANHOLE_SEW: "하수맨홀",
  MANHOLE_RAIN: "우수맨홀",
  INLET_RAIN: "우수받이",
  PUMP: "펌프장",
  TREATMENT: "처리시설",
  VALVE: "밸브",
};

export default function Legend() {
  const layers = useLayerStore((s) => s.layers);
  const visibleIds = useLayerStore((s) => s.visibleIds);
  const [collapsed, setCollapsed] = useState(false);

  const activeLayers = layers.filter(
    (l) => visibleIds.has(l.id) && !l.code.endsWith("_LABELS"),
  );

  if (activeLayers.length === 0) return null;

  return (
    <div className="absolute right-3 bottom-8 z-10 max-h-[50vh] overflow-y-auto rounded-lg bg-white/95 shadow-lg backdrop-blur-sm">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-gray-700"
      >
        <span>범례</span>
        <svg
          className={`h-3 w-3 text-gray-400 transition-transform ${collapsed ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M2 8l4-4 4 4" />
        </svg>
      </button>

      {!collapsed && (
        <div className="space-y-1 px-3 pb-2">
          {activeLayers.map((layer) => {
            const style = (layer.style ?? {}) as Record<string, unknown>;
            const shape = resolveShape(style);
            const color = resolveColor(style);
            const matchItems = resolveMatchItems(style);

            return (
              <div key={layer.id}>
                {matchItems ? (
                  /* Layer with sub-categories (match expression) */
                  <div>
                    <div className="mb-0.5 text-[10px] font-medium text-gray-500">
                      {layer.name}
                    </div>
                    {matchItems.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-2 py-0.5 pl-1"
                      >
                        <Symbol shape={shape} color={item.color} />
                        <span className="text-[11px] text-gray-600">
                          {TYPE_LABELS[item.label] ?? item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Simple layer */
                  <div className="flex items-center gap-2 py-0.5">
                    <Symbol shape={shape} color={color} />
                    <span className="text-[11px] text-gray-600">
                      {layer.name}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Symbol({ shape, color }: { shape: string; color: string }) {
  if (shape === "fill") {
    return (
      <span
        className="inline-block h-3 w-4 shrink-0 rounded-sm border border-gray-300/50"
        style={{ backgroundColor: color, opacity: 0.7 }}
      />
    );
  }
  if (shape === "circle") {
    return (
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full border border-white"
        style={{ backgroundColor: color }}
      />
    );
  }
  // line
  return (
    <span className="relative inline-block h-3 w-4 shrink-0">
      <span
        className="absolute top-1/2 left-0 h-[3px] w-full rounded-full"
        style={{ backgroundColor: color, transform: "translateY(-50%)" }}
      />
    </span>
  );
}
