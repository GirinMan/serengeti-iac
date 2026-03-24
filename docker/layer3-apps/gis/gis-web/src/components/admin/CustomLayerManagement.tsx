import { useEffect, useState, useRef } from "react";
import { fetchLayers, createCustomLayer, deleteCustomLayer, updateCustomLayer, replaceCustomLayerGeoJSON, type Layer } from "@/api/layers";
import { fetchRegions, type Region } from "@/api/regions";
import { useAuthStore } from "@/stores/authStore";
import { useMapStore } from "@/stores/mapStore";
import { useLayerStore } from "@/stores/layerStore";

const LAYER_TYPES = [
  { value: "fill", label: "면(Polygon)" },
  { value: "line", label: "선(Line)" },
  { value: "circle", label: "점(Point)" },
];

const CUSTOM_CATEGORY = "custom_geojson";

export default function CustomLayerManagement() {
  const currentUser = useAuthStore((s) => s.user);
  const region = useMapStore((s) => s.region);
  const setLayers = useLayerStore((s) => s.setLayers);
  const [customLayers, setCustomLayers] = useState<Layer[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState("#3388ff");
  const [formType, setFormType] = useState("fill");
  const [formRegion, setFormRegion] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editColor, setEditColor] = useState("#3388ff");
  const [editOpacity, setEditOpacity] = useState(0.5);
  const [editWidth, setEditWidth] = useState(2);
  const [renamingCode, setRenamingCode] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [replacingCode, setReplacingCode] = useState<string | null>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);

  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "editor")) return null;
  const isAdmin = currentUser.role === "admin";

  const load = async () => {
    setLoading(true);
    try {
      const [layers, rg] = await Promise.all([
        fetchLayers(region?.code),
        fetchRegions(),
      ]);
      setCustomLayers(layers.filter((l) => l.category === CUSTOM_CATEGORY));
      setRegions(rg);
      if (rg.length > 0 && !formRegion) setFormRegion(rg[0].code);
    } catch {
      setError("커스텀 레이어 로딩 실패");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { load(); }, [region?.code]);

  const showMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("GeoJSON 파일을 선택해주세요");
      return;
    }
    if (!formName.trim()) {
      setError("레이어 이름을 입력해주세요");
      return;
    }
    try {
      await createCustomLayer(file, formName.trim(), formRegion, formColor, formType);
      showMsg(`커스텀 레이어 "${formName.trim()}" 등록 완료`);
      setShowForm(false);
      setFormName("");
      setFormColor("#3388ff");
      if (fileRef.current) fileRef.current.value = "";
      // Refresh layers for map
      if (region) {
        const layers = await fetchLayers(region.code);
        setLayers(layers);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록 실패");
    }
  };

  const handleDelete = async (layer: Layer) => {
    if (!confirm(`"${layer.name}" 커스텀 레이어를 삭제하시겠습니까?`)) return;
    try {
      await deleteCustomLayer(layer.code);
      showMsg(`"${layer.name}" 삭제 완료`);
      if (region) {
        const layers = await fetchLayers(region.code);
        setLayers(layers);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  const startEdit = (layer: Layer) => {
    const s = layer.style ?? {};
    const lt = (s.type as string) ?? "fill";
    setEditingCode(layer.code);
    setEditColor(
      (s["fill-color"] as string) ?? (s["line-color"] as string) ?? (s["circle-color"] as string) ?? "#3388ff",
    );
    setEditOpacity(
      lt === "fill" ? ((s["fill-opacity"] as number) ?? 0.5) : ((s["line-opacity"] as number) ?? 0.8),
    );
    setEditWidth(
      lt === "line" ? ((s["line-width"] as number) ?? 2) : ((s["circle-radius"] as number) ?? 5),
    );
  };

  const handleRename = async () => {
    if (!renamingCode || !renameName.trim()) return;
    try {
      await updateCustomLayer(renamingCode, { name: renameName.trim() });
      showMsg("이름 변경 완료");
      setRenamingCode(null);
      if (region) {
        const layers = await fetchLayers(region.code);
        setLayers(layers);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "이름 변경 실패");
    }
  };

  const handleStyleUpdate = async () => {
    if (!editingCode) return;
    try {
      await updateCustomLayer(editingCode, {
        color: editColor,
        opacity: editOpacity,
        width: editWidth,
      });
      showMsg("스타일 변경 완료");
      setEditingCode(null);
      if (region) {
        const layers = await fetchLayers(region.code);
        setLayers(layers);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "스타일 변경 실패");
    }
  };

  const handleReplaceFile = async (code: string) => {
    const file = replaceFileRef.current?.files?.[0];
    if (!file) {
      setError("GeoJSON 파일을 선택해주세요");
      return;
    }
    try {
      await replaceCustomLayerGeoJSON(code, file);
      showMsg("GeoJSON 파일 교체 완료");
      setReplacingCode(null);
      if (replaceFileRef.current) replaceFileRef.current.value = "";
      // Force map to reload GeoJSON source data
      const mapInst = useMapStore.getState().map;
      if (mapInst) {
        const sourceId = `src-${code}`;
        const src = mapInst.getSource(sourceId);
        if (src && "setData" in src) {
          const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
          (src as { setData: (url: string) => void }).setData(
            `${window.location.origin}${API_BASE}/v1/layers/custom/${code}/geojson?t=${Date.now()}`,
          );
        }
      }
      if (region) {
        const layers = await fetchLayers(region.code);
        setLayers(layers);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 교체 실패");
    }
  };

  return (
    <div className="border-t pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-500">커스텀 레이어 (GeoJSON)</h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-violet-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-violet-700"
        >
          {showForm ? "취소" : "+ 레이어 추가"}
        </button>
      </div>

      {success && (
        <div className="mb-2 rounded bg-green-50 px-3 py-1.5 text-xs text-green-700">{success}</div>
      )}
      {error && (
        <div className="mb-2 rounded bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-3 space-y-2 rounded border bg-gray-50 p-2">
          <div>
            <label className="block text-xs font-medium text-gray-600">레이어 이름</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="예: 하천 경계, 산책로"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">도형 유형</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm"
              >
                {LAYER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">지역</label>
              <select
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm"
              >
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>{r.name} ({r.code})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">GeoJSON 파일</label>
              <input
                ref={fileRef}
                type="file"
                accept=".geojson,.json"
                className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-violet-50 file:px-2 file:py-1 file:text-xs file:text-violet-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">색상</label>
              <input
                type="color"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded bg-violet-600 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            레이어 등록
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-xs text-gray-400">로딩 중...</div>
      ) : (
        <div className="space-y-1">
          {customLayers.map((layer) => {
            const isEditing = editingCode === layer.code;
            const lt = (layer.style?.type as string) ?? "fill";
            return (
              <div key={layer.id} className={`rounded border bg-white px-2 py-1.5 text-xs ${isEditing ? "border-violet-400" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-sm border"
                      style={{
                        backgroundColor:
                          (layer.style?.["fill-color"] as string) ??
                          (layer.style?.["line-color"] as string) ??
                          (layer.style?.["circle-color"] as string) ??
                          "#3388ff",
                      }}
                    />
                    <span className="font-medium text-gray-700">{layer.name}</span>
                    <span className="text-gray-400">
                      {LAYER_TYPES.find((t) => t.value === layer.style?.type)?.label ?? ""}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => { setRenamingCode(renamingCode === layer.code ? null : layer.code); setRenameName(layer.name); }}
                          className="rounded px-1.5 py-0.5 text-gray-600 hover:bg-gray-100"
                        >
                          이름
                        </button>
                        <button
                          onClick={() => startEdit(layer)}
                          className="rounded px-1.5 py-0.5 text-violet-600 hover:bg-violet-50"
                        >
                          스타일
                        </button>
                        <button
                          onClick={() => setReplacingCode(replacingCode === layer.code ? null : layer.code)}
                          className="rounded px-1.5 py-0.5 text-emerald-600 hover:bg-emerald-50"
                        >
                          파일
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(layer)}
                        className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
                {renamingCode === layer.code && !isEditing && (
                  <div className="mt-1.5 flex gap-1">
                    <input
                      value={renameName}
                      onChange={(e) => setRenameName(e.target.value)}
                      className="flex-1 rounded border px-2 py-0.5 text-xs"
                      placeholder="새 이름"
                      onKeyDown={(e) => e.key === "Enter" && handleRename()}
                    />
                    <button
                      onClick={handleRename}
                      className="rounded bg-gray-600 px-2 py-0.5 text-xs text-white hover:bg-gray-700"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setRenamingCode(null)}
                      className="rounded border px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      취소
                    </button>
                  </div>
                )}
                {replacingCode === layer.code && !isEditing && (
                  <div className="mt-1.5 space-y-1 rounded border border-emerald-200 bg-emerald-50 p-2">
                    <label className="block text-xs font-medium text-emerald-700">새 GeoJSON 파일</label>
                    <input
                      ref={replaceFileRef}
                      type="file"
                      accept=".geojson,.json"
                      className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-emerald-100 file:px-2 file:py-1 file:text-xs file:text-emerald-700"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleReplaceFile(layer.code)}
                        className="flex-1 rounded bg-emerald-600 py-0.5 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        교체
                      </button>
                      <button
                        onClick={() => { setReplacingCode(null); if (replaceFileRef.current) replaceFileRef.current.value = ""; }}
                        className="flex-1 rounded border py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
                {isEditing && (
                  <div className="mt-2 space-y-1.5 border-t pt-2">
                    <div className="flex items-center gap-2">
                      <label className="w-10 text-xs text-gray-500">색상</label>
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="h-6 w-8 cursor-pointer rounded border"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="w-10 text-xs text-gray-500">투명도</label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={editOpacity}
                        onChange={(e) => setEditOpacity(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="w-8 text-right text-xs text-gray-500">{Math.round(editOpacity * 100)}%</span>
                    </div>
                    {(lt === "line" || lt === "circle") && (
                      <div className="flex items-center gap-2">
                        <label className="w-10 text-xs text-gray-500">{lt === "line" ? "두께" : "크기"}</label>
                        <input
                          type="range"
                          min={lt === "line" ? 0.5 : 1}
                          max={lt === "line" ? 10 : 20}
                          step={0.5}
                          value={editWidth}
                          onChange={(e) => setEditWidth(Number(e.target.value))}
                          className="flex-1"
                        />
                        <span className="w-8 text-right text-xs text-gray-500">{editWidth}</span>
                      </div>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={handleStyleUpdate}
                        className="flex-1 rounded bg-violet-600 py-1 text-xs font-medium text-white hover:bg-violet-700"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingCode(null)}
                        className="flex-1 rounded border py-1 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {customLayers.length === 0 && (
            <div className="text-xs text-gray-400">등록된 커스텀 레이어가 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}
