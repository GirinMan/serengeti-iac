import { useState } from "react";
import { useLayerStore } from "@/stores/layerStore";

const CATEGORY_LABELS: Record<string, string> = {
  BASE: "기본 지도",
  ORTHO: "항공사진",
  FACILITY: "시설물",
};

export default function LayerTree() {
  const layers = useLayerStore((s) => s.layers);
  const visibleIds = useLayerStore((s) => s.visibleIds);
  const toggleLayer = useLayerStore((s) => s.toggleLayer);
  const opacityMap = useLayerStore((s) => s.opacityMap);
  const setOpacity = useLayerStore((s) => s.setOpacity);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Identify child label layers (code ends with _LABELS) and their parents
  const childCodes = new Set(
    layers.filter((l) => l.code.endsWith("_LABELS")).map((l) => l.code),
  );

  const grouped = layers
    .filter((l) => !childCodes.has(l.code)) // Exclude child labels from top-level
    .reduce<Record<string, typeof layers>>((acc, layer) => {
      const cat = layer.category || "기타";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(layer);
      return acc;
    }, {});

  if (layers.length === 0) {
    return (
      <div className="p-3 text-sm text-gray-400">
        지역을 선택하면 레이어가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="p-3">
      <h3 className="mb-2 text-xs font-semibold text-gray-600 uppercase">
        레이어
      </h3>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mb-2">
          <div className="mb-1 text-xs font-medium text-gray-500">
            {CATEGORY_LABELS[category] ?? category}
          </div>
          {items.map((layer) => {
            const opacity = opacityMap.get(layer.id) ?? 1;
            const isExpanded = expandedId === layer.id;
            const childLabel = layers.find(
              (l) => l.code === layer.code + "_LABELS",
            );
            return (
              <div key={layer.id}>
                <div className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-gray-100">
                  <label className="flex flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={visibleIds.has(layer.id)}
                      onChange={() => toggleLayer(layer.id)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                    />
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: (() => {
                          const s = layer.style as Record<string, unknown>;
                          const c = s["fill-color"] ?? s["line-color"] ?? s["circle-color"] ?? "#888";
                          if (typeof c === "string") return c;
                          if (Array.isArray(c) && c[0] === "match" && c.length >= 4) return c[3] as string;
                          return "#888";
                        })(),
                        opacity,
                      }}
                    />
                    <span>{layer.name}</span>
                  </label>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : layer.id)}
                    className="px-1 text-gray-400 hover:text-gray-600"
                    title="투명도 조절"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                      <path d="M8 2a6 6 0 0 1 0 12z" />
                    </svg>
                  </button>
                </div>
                {isExpanded && (
                  <div className="flex items-center gap-2 py-1 pl-8 pr-1">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={opacity}
                      onChange={(e) => setOpacity(layer.id, parseFloat(e.target.value))}
                      className="h-1 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-600"
                    />
                    <span className="w-8 text-right text-[10px] text-gray-400">
                      {Math.round(opacity * 100)}%
                    </span>
                  </div>
                )}
                {childLabel && (
                  <div className="ml-5 border-l border-gray-200 pl-1">
                    <div className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-gray-50">
                      <label className="flex flex-1 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={visibleIds.has(childLabel.id)}
                          onChange={() => toggleLayer(childLabel.id)}
                          className="h-3 w-3 rounded border-gray-300 text-blue-500"
                        />
                        <svg className="h-2.5 w-2.5 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
                          <text x="1" y="13" fontSize="14" fontWeight="bold">T</text>
                        </svg>
                        <span>{childLabel.name}</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
