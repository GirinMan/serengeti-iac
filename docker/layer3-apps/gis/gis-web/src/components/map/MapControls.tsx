import { useMapStore } from "@/stores/mapStore";
import MapExport from "./MapExport";
import BasemapSwitcher from "./BasemapSwitcher";

export default function MapControls() {
  const { map, region } = useMapStore();

  const handleFitRegion = () => {
    if (!map || !region?.bbox) return;
    const coords = region.bbox.coordinates[0];
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    map.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: 40, duration: 500 },
    );
  };

  return (
    <div className="absolute top-14 left-3 z-10 flex flex-col gap-1 md:top-3">
      <button
        onClick={handleFitRegion}
        className="rounded bg-white px-3 py-2.5 text-sm font-medium shadow hover:bg-gray-50 md:px-2 md:py-1.5 md:text-xs"
        title="전체 지역 보기"
      >
        전체 보기
      </button>
      <BasemapSwitcher />
      <MapExport />
    </div>
  );
}
