import { useEffect, useState } from "react";
import { fetchRegions, type Region } from "@/api/regions";
import { fetchLayers } from "@/api/layers";
import { useMapStore } from "@/stores/mapStore";
import { useLayerStore } from "@/stores/layerStore";

export default function RegionSelector() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const { region, setRegion } = useMapStore();
  const setLayers = useLayerStore((s) => s.setLayers);

  useEffect(() => {
    fetchRegions()
      .then((data) => {
        setRegions(data);
        if (data.length > 0 && !region) {
          selectRegion(data[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectRegion = async (r: Region) => {
    setRegion(r);
    try {
      const layers = await fetchLayers(r.code);
      setLayers(layers);
    } catch (err) {
      console.error("Failed to fetch layers:", err);
    }
  };

  if (loading) return <div className="p-3 text-sm text-gray-500">로딩 중...</div>;

  return (
    <div className="p-3">
      <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">
        지역 선택
      </label>
      <select
        value={region?.code ?? ""}
        onChange={(e) => {
          const r = regions.find((r) => r.code === e.target.value);
          if (r) selectRegion(r);
        }}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      >
        {regions.map((r) => (
          <option key={r.code} value={r.code}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
