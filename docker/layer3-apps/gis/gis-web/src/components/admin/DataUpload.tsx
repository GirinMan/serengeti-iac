import { useState, useRef } from "react";
import { uploadImportFile } from "@/api/imports";
import { useMapStore } from "@/stores/mapStore";

const TARGET_TABLES = [
  { value: "parcels", label: "지번 (parcels)" },
  { value: "buildings", label: "건물 (buildings)" },
  { value: "facilities", label: "시설물 (facilities)" },
];

const FACILITY_TYPES = [
  { value: "MANHOLE_SEW", label: "하수맨홀" },
  { value: "MANHOLE_RAIN", label: "우수맨홀" },
  { value: "PIPE_SEW", label: "하수관로" },
  { value: "PIPE_RAIN", label: "우수관로" },
  { value: "PUMP", label: "펌프" },
  { value: "TREATMENT", label: "처리시설" },
  { value: "VALVE", label: "밸브" },
];

const ALLOWED_EXTENSIONS = [".shp", ".geojson", ".json", ".zip", ".gpkg", ".csv"];

interface Props {
  onUploaded?: () => void;
}

export default function DataUpload({ onUploaded }: Props) {
  const region = useMapStore((s) => s.region);
  const fileRef = useRef<HTMLInputElement>(null);
  const [targetTable, setTargetTable] = useState("parcels");
  const [facilityType, setFacilityType] = useState("MANHOLE_SEW");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !region) return;

    setUploading(true);
    setResult(null);
    try {
      const res = await uploadImportFile(
        file, region.code, targetTable,
        targetTable === "facilities" ? facilityType : undefined,
      );
      setResult({ ok: true, msg: `${res.message} (ID: ${res.import_id})` });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onUploaded?.();
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : "업로드 실패" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">대상 테이블</label>
        <select
          value={targetTable}
          onChange={(e) => setTargetTable(e.target.value)}
          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        >
          {TARGET_TABLES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {targetTable === "facilities" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">시설물 유형</label>
          <select
            value={facilityType}
            onChange={(e) => setFacilityType(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            {FACILITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          파일 ({ALLOWED_EXTENSIONS.join(", ")})
        </label>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      <div className="text-xs text-gray-400">
        지역: {region?.name ?? "선택 안됨"} ({region?.code ?? "-"})
      </div>

      <button
        type="submit"
        disabled={!file || !region || uploading}
        className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? "업로드 중..." : "업로드"}
      </button>

      {result && (
        <div className={`rounded px-3 py-2 text-sm ${result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {result.msg}
        </div>
      )}
    </form>
  );
}
