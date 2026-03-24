import { useEffect, useState } from "react";
import { useMapStore } from "@/stores/mapStore";

export default function CoordinateDisplay() {
  const map = useMapStore((s) => s.map);
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [zoom, setZoom] = useState<number>(0);

  useEffect(() => {
    if (!map) return;

    setZoom(map.getZoom());

    const onMouseMove = (e: { lngLat: { lng: number; lat: number } }) => {
      setCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };

    const onZoom = () => {
      setZoom(map.getZoom());
    };

    map.on("mousemove", onMouseMove);
    map.on("zoom", onZoom);

    return () => {
      map.off("mousemove", onMouseMove);
      map.off("zoom", onZoom);
    };
  }, [map]);

  if (!map) return null;

  return (
    <div className="absolute bottom-1 right-2 z-10 hidden gap-3 rounded bg-white/85 px-2 py-1 text-[11px] font-mono text-gray-600 shadow-sm backdrop-blur-sm md:flex">
      {coords ? (
        <span>
          {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
        </span>
      ) : (
        <span className="text-gray-400">--</span>
      )}
      <span className="border-l border-gray-300 pl-3">
        Z{zoom.toFixed(1)}
      </span>
    </div>
  );
}
