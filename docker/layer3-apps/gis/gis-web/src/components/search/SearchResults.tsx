import type { SearchResult } from "@/api/search";
import { useMapStore } from "@/stores/mapStore";

const TYPE_LABELS: Record<string, string> = {
  parcel: "지번",
  building: "건물",
  facility: "시설물",
};

interface Props {
  results: SearchResult[];
  onClose: () => void;
  onResultSelect?: () => void;
}

export default function SearchResults({ results, onClose, onResultSelect }: Props) {
  const map = useMapStore((s) => s.map);
  const setHighlightCoord = useMapStore((s) => s.setHighlightCoord);

  const handleSelect = (result: SearchResult) => {
    if (!map || !result.location) return;
    map.flyTo({
      center: [result.location.lng, result.location.lat],
      zoom: 17,
      duration: 800,
    });
    setHighlightCoord({
      lng: result.location.lng,
      lat: result.location.lat,
      label: result.title,
    });
    onClose();
    onResultSelect?.();
  };

  return (
    <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-60 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-gray-500">
          {results.length}건
        </span>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">
          닫기
        </button>
      </div>
      {results.map((r) => (
        <button
          key={r.id}
          onClick={() => handleSelect(r)}
          className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
        >
          <span className="mr-1.5 inline-block rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-500">
            {TYPE_LABELS[r.type] ?? r.type}
          </span>
          <span>{r.title}</span>
          {r.address && (
            <span className="ml-1 text-xs text-gray-400">{r.address}</span>
          )}
        </button>
      ))}
    </div>
  );
}
