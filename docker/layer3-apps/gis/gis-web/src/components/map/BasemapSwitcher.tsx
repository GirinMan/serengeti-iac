import { useState } from "react";
import { useMapStore } from "@/stores/mapStore";

const BASEMAPS = [
  {
    id: "osm",
    label: "일반",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "&copy; OpenStreetMap contributors",
    maxzoom: 19,
  },
  {
    id: "satellite",
    label: "위성",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "&copy; Esri",
    maxzoom: 19,
  },
  {
    id: "topo",
    label: "지형",
    tiles: ["https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png".replace("{s}", "a")],
    attribution: "&copy; OpenTopoMap",
    maxzoom: 17,
  },
] as const;

export default function BasemapSwitcher() {
  const map = useMapStore((s) => s.map);
  const [current, setCurrent] = useState("osm");

  const handleSwitch = (basemapId: string) => {
    if (!map || basemapId === current) return;
    const basemap = BASEMAPS.find((b) => b.id === basemapId);
    if (!basemap) return;

    const source = map.getSource("osm") as maplibregl.RasterTileSource | undefined;
    if (source) {
      // Update tiles by removing and re-adding the source
      map.removeLayer("osm-tiles");
      map.removeSource("osm");
      map.addSource("osm", {
        type: "raster",
        tiles: [...basemap.tiles],
        tileSize: 256,
        maxzoom: basemap.maxzoom,
        attribution: basemap.attribution,
      });
      // Add layer back at the bottom (before all other layers)
      const firstLayerId = map.getStyle().layers.find((l) => l.id !== "osm-tiles")?.id;
      map.addLayer(
        {
          id: "osm-tiles",
          type: "raster",
          source: "osm",
          minzoom: 0,
          maxzoom: basemap.maxzoom,
        },
        firstLayerId,
      );
    }
    setCurrent(basemapId);
  };

  return (
    <div className="flex gap-0.5 rounded bg-white shadow">
      {BASEMAPS.map((b) => (
        <button
          key={b.id}
          onClick={() => handleSwitch(b.id)}
          className={`px-2.5 py-1.5 text-xs font-medium transition-colors first:rounded-l last:rounded-r ${
            current === b.id
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
          title={`${b.label} 지도`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
