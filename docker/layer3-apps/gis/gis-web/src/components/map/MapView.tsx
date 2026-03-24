import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { useMapStore } from "@/stores/mapStore";

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, setMap, region } = useMapStore();

  useEffect(() => {
    if (!containerRef.current) return;

    const m = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        name: "GIS Basemap",
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [127.2, 37.9],
      zoom: 12,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });

    m.addControl(new maplibregl.NavigationControl(), "top-right");
    m.addControl(
      new maplibregl.ScaleControl({ maxWidth: 200 }),
      "bottom-left",
    );

    m.on("load", () => {
      setMap(m);
      // Expose map instance for debugging/QA
      (window as any).__gis_map = m;
    });

    return () => {
      setMap(null);
      m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map || !region?.bbox) return;

    const coords = region.bbox.coordinates[0];
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const bounds: [number, number, number, number] = [
      Math.min(...lngs),
      Math.min(...lats),
      Math.max(...lngs),
      Math.max(...lats),
    ];
    map.fitBounds(bounds, { padding: 40, duration: 1000 });
  }, [map, region]);

  return (
    <div ref={containerRef} className="h-full w-full" />
  );
}
