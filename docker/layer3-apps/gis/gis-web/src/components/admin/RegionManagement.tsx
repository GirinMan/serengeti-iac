import { useEffect, useState, useRef, useCallback } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import {
  fetchRegions,
  createRegion,
  updateRegion,
  deleteRegion,
  type Region,
  type RegionCreatePayload,
  type RegionUpdatePayload,
} from "@/api/regions";
import { useMapStore } from "@/stores/mapStore";
import { useAuthStore } from "@/stores/authStore";

export default function RegionManagement() {
  const currentUser = useAuthStore((s) => s.user);
  const map = useMapStore((s) => s.map);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // create form
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [bboxWkt, setBboxWkt] = useState("");
  const [centerWkt, setCenterWkt] = useState("");
  const [zoomMin, setZoomMin] = useState(10);
  const [zoomMax, setZoomMax] = useState(19);

  // edit state
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editZoomMin, setEditZoomMin] = useState(10);
  const [editZoomMax, setEditZoomMax] = useState(19);
  const [editBboxWkt, setEditBboxWkt] = useState("");
  const [editCenterWkt, setEditCenterWkt] = useState("");

  // bbox draw state: "create" | "edit" | null
  const [drawingTarget, setDrawingTarget] = useState<"create" | "edit" | null>(null);
  const drawStateRef = useRef<{
    startX: number;
    startY: number;
    overlay: HTMLDivElement | null;
    rect: HTMLDivElement | null;
  }>({ startX: 0, startY: 0, overlay: null, rect: null });

  const PREVIEW_SOURCE = "region-bbox-preview";
  const PREVIEW_FILL = "region-bbox-preview-fill";
  const PREVIEW_LINE = "region-bbox-preview-line";

  const showBboxPreview = useCallback(
    (sw: { lng: number; lat: number }, ne: { lng: number; lat: number }) => {
      if (!map) return;
      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [sw.lng, sw.lat],
                  [ne.lng, sw.lat],
                  [ne.lng, ne.lat],
                  [sw.lng, ne.lat],
                  [sw.lng, sw.lat],
                ],
              ],
            },
          },
        ],
      };
      const src = map.getSource(PREVIEW_SOURCE) as GeoJSONSource | undefined;
      if (src) {
        src.setData(geojson);
      } else {
        map.addSource(PREVIEW_SOURCE, { type: "geojson", data: geojson });
        map.addLayer({
          id: PREVIEW_FILL,
          type: "fill",
          source: PREVIEW_SOURCE,
          paint: { "fill-color": "#3b82f6", "fill-opacity": 0.12 },
        });
        map.addLayer({
          id: PREVIEW_LINE,
          type: "line",
          source: PREVIEW_SOURCE,
          paint: { "line-color": "#3b82f6", "line-width": 2, "line-dasharray": [4, 2] },
        });
      }
    },
    [map],
  );

  const clearBboxPreview = useCallback(() => {
    if (!map) return;
    if (map.getLayer(PREVIEW_FILL)) map.removeLayer(PREVIEW_FILL);
    if (map.getLayer(PREVIEW_LINE)) map.removeLayer(PREVIEW_LINE);
    if (map.getSource(PREVIEW_SOURCE)) map.removeSource(PREVIEW_SOURCE);
  }, [map]);

  const applyDrawnBbox = useCallback(
    (sw: { lng: number; lat: number }, ne: { lng: number; lat: number }, zoom: number) => {
      const wkt = `POLYGON((${sw.lng} ${sw.lat}, ${ne.lng} ${sw.lat}, ${ne.lng} ${ne.lat}, ${sw.lng} ${ne.lat}, ${sw.lng} ${sw.lat}))`;
      const cLng = (sw.lng + ne.lng) / 2;
      const cLat = (sw.lat + ne.lat) / 2;
      const center = `POINT(${cLng} ${cLat})`;
      showBboxPreview(sw, ne);
      if (drawingTarget === "create") {
        setBboxWkt(wkt);
        setCenterWkt(center);
        setZoomMin(Math.max(8, zoom - 4));
        setZoomMax(Math.min(19, zoom + 4));
      } else if (drawingTarget === "edit") {
        setEditBboxWkt(wkt);
        setEditCenterWkt(center);
        setEditZoomMin(Math.max(8, zoom - 4));
        setEditZoomMax(Math.min(19, zoom + 4));
      }
    },
    [drawingTarget, showBboxPreview],
  );

  // bbox draw mode effect
  useEffect(() => {
    if (!drawingTarget || !map) return;

    const container = map.getContainer();
    const canvas = map.getCanvas();
    const ds = drawStateRef.current;

    // Disable map interactions during draw
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.doubleClickZoom.disable();
    canvas.style.cursor = "crosshair";

    // Create overlay for drawing
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:absolute;inset:0;z-index:50;cursor:crosshair;";
    container.appendChild(overlay);
    ds.overlay = overlay;

    // Drawing rectangle element
    const rect = document.createElement("div");
    rect.style.cssText =
      "position:absolute;border:2px dashed #3b82f6;background:rgba(59,130,246,0.15);pointer-events:none;display:none;";
    overlay.appendChild(rect);
    ds.rect = rect;

    let drawing = false;

    const onMouseDown = (e: MouseEvent) => {
      drawing = true;
      const r = container.getBoundingClientRect();
      ds.startX = e.clientX - r.left;
      ds.startY = e.clientY - r.top;
      rect.style.display = "block";
      rect.style.left = `${ds.startX}px`;
      rect.style.top = `${ds.startY}px`;
      rect.style.width = "0px";
      rect.style.height = "0px";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!drawing) return;
      const r = container.getBoundingClientRect();
      const curX = e.clientX - r.left;
      const curY = e.clientY - r.top;
      const x = Math.min(ds.startX, curX);
      const y = Math.min(ds.startY, curY);
      const w = Math.abs(curX - ds.startX);
      const h = Math.abs(curY - ds.startY);
      rect.style.left = `${x}px`;
      rect.style.top = `${y}px`;
      rect.style.width = `${w}px`;
      rect.style.height = `${h}px`;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!drawing) return;
      drawing = false;
      const r = container.getBoundingClientRect();
      const endX = e.clientX - r.left;
      const endY = e.clientY - r.top;

      // Minimum drag size check (10px)
      if (Math.abs(endX - ds.startX) > 10 && Math.abs(endY - ds.startY) > 10) {
        const sw = map.unproject([
          Math.min(ds.startX, endX),
          Math.max(ds.startY, endY),
        ]);
        const ne = map.unproject([
          Math.max(ds.startX, endX),
          Math.min(ds.startY, endY),
        ]);
        const zoom = Math.round(map.getZoom());
        applyDrawnBbox(sw, ne, zoom);
      }

      // Exit drawing mode
      setDrawingTarget(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawingTarget(null);
    };

    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      overlay.removeEventListener("mousedown", onMouseDown);
      overlay.removeEventListener("mousemove", onMouseMove);
      overlay.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
      if (ds.overlay && container.contains(ds.overlay)) {
        container.removeChild(ds.overlay);
      }
      ds.overlay = null;
      ds.rect = null;
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.doubleClickZoom.enable();
      canvas.style.cursor = "";
    };
  }, [drawingTarget, map, applyDrawnBbox]);

  if (currentUser?.role !== "admin") return null;

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchRegions();
      setRegions(data);
    } catch {
      setError("지역 목록 로딩 실패");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { load(); }, []);

  const captureFromMap = () => {
    if (!map) return;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const center = map.getCenter();
    const zoom = Math.round(map.getZoom());

    setBboxWkt(
      `POLYGON((${sw.lng} ${sw.lat}, ${ne.lng} ${sw.lat}, ${ne.lng} ${ne.lat}, ${sw.lng} ${ne.lat}, ${sw.lng} ${sw.lat}))`,
    );
    setCenterWkt(`POINT(${center.lng} ${center.lat})`);
    setZoomMin(Math.max(8, zoom - 4));
    setZoomMax(Math.min(19, zoom + 4));
    showBboxPreview(sw, ne);
  };

  const showMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!code.trim() || !name.trim() || !bboxWkt.trim() || !centerWkt.trim()) {
      setError("모든 필드를 입력하세요");
      return;
    }

    try {
      const payload: RegionCreatePayload = {
        code: code.trim(),
        name: name.trim(),
        bbox_wkt: bboxWkt.trim(),
        center_wkt: centerWkt.trim(),
        zoom_min: zoomMin,
        zoom_max: zoomMax,
      };
      await createRegion(payload);
      showMsg(`지역 "${name.trim()}" 등록 완료`);
      clearBboxPreview();
      setShowForm(false);
      setCode("");
      setName("");
      setBboxWkt("");
      setCenterWkt("");
      setZoomMin(10);
      setZoomMax(19);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "지역 등록 실패");
    }
  };

  const startEdit = (r: Region) => {
    setEditingCode(r.code);
    setEditName(r.name);
    setEditZoomMin(r.zoom_min);
    setEditZoomMax(r.zoom_max);
    setEditBboxWkt("");
    setEditCenterWkt("");
    setError("");
  };

  const captureFromMapForEdit = () => {
    if (!map) return;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const center = map.getCenter();
    const zoom = Math.round(map.getZoom());

    setEditBboxWkt(
      `POLYGON((${sw.lng} ${sw.lat}, ${ne.lng} ${sw.lat}, ${ne.lng} ${ne.lat}, ${sw.lng} ${ne.lat}, ${sw.lng} ${sw.lat}))`,
    );
    setEditCenterWkt(`POINT(${center.lng} ${center.lat})`);
    setEditZoomMin(Math.max(8, zoom - 4));
    setEditZoomMax(Math.min(19, zoom + 4));
    showBboxPreview(sw, ne);
  };

  const cancelEdit = () => {
    clearBboxPreview();
    setEditingCode(null);
  };

  const handleUpdate = async (regionCode: string) => {
    setError("");
    try {
      const payload: RegionUpdatePayload = {
        name: editName.trim(),
        zoom_min: editZoomMin,
        zoom_max: editZoomMax,
      };
      if (editBboxWkt.trim()) payload.bbox_wkt = editBboxWkt.trim();
      if (editCenterWkt.trim()) payload.center_wkt = editCenterWkt.trim();
      await updateRegion(regionCode, payload);
      showMsg(`지역 "${editName.trim()}" 수정 완료`);
      clearBboxPreview();
      setEditingCode(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "지역 수정 실패");
    }
  };

  const handleDelete = async (r: Region) => {
    if (!confirm(`정말 "${r.name}" 지역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    setError("");
    try {
      await deleteRegion(r.code);
      showMsg(`지역 "${r.name}" 삭제 완료`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "지역 삭제 실패");
    }
  };

  return (
    <div className="border-t pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-500">지역 관리</h4>
        <button
          onClick={() => { if (showForm) clearBboxPreview(); setShowForm(!showForm); }}
          className="rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-700"
        >
          {showForm ? "취소" : "+ 지역 추가"}
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
            <label className="block text-xs font-medium text-gray-600">지역 코드</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: SEOUL_GANGNAM"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">지역 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 서울 강남구"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">BBOX (WKT)</label>
            <textarea
              value={bboxWkt}
              onChange={(e) => setBboxWkt(e.target.value)}
              rows={2}
              placeholder="POLYGON((lng lat, ...))"
              className="w-full rounded border px-2 py-1 font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">CENTER (WKT)</label>
            <input
              value={centerWkt}
              onChange={(e) => setCenterWkt(e.target.value)}
              placeholder="POINT(lng lat)"
              className="w-full rounded border px-2 py-1 font-mono text-xs"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">최소 줌</label>
              <input
                type="number"
                value={zoomMin}
                onChange={(e) => setZoomMin(Number(e.target.value))}
                min={1}
                max={20}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">최대 줌</label>
              <input
                type="number"
                value={zoomMax}
                onChange={(e) => setZoomMax(Number(e.target.value))}
                min={1}
                max={20}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={captureFromMap}
              className="flex-1 rounded border border-blue-300 bg-blue-50 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              현재 뷰 자동 채우기
            </button>
            <button
              type="button"
              onClick={() => setDrawingTarget("create")}
              className="flex-1 rounded border border-indigo-300 bg-indigo-50 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              맵에서 영역 선택
            </button>
          </div>
          {drawingTarget === "create" && (
            <div className="flex items-center gap-1.5 rounded bg-indigo-50 px-2 py-1.5 text-xs text-indigo-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
              맵에서 드래그하여 영역을 선택하세요 (ESC: 취소)
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded bg-blue-600 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            지역 등록
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-xs text-gray-400">로딩 중...</div>
      ) : (
        <div className="space-y-1">
          {regions.map((r) =>
            editingCode === r.code ? (
              <div key={r.id} className="rounded border border-blue-200 bg-blue-50 p-2 space-y-1.5">
                <div>
                  <label className="block text-xs font-medium text-gray-600">이름</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600">최소 줌</label>
                    <input
                      type="number"
                      value={editZoomMin}
                      onChange={(e) => setEditZoomMin(Number(e.target.value))}
                      min={1}
                      max={20}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600">최대 줌</label>
                    <input
                      type="number"
                      value={editZoomMax}
                      onChange={(e) => setEditZoomMax(Number(e.target.value))}
                      min={1}
                      max={20}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={captureFromMapForEdit}
                    className="flex-1 rounded border border-blue-300 bg-white py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    현재 뷰로 업데이트
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawingTarget("edit")}
                    className="flex-1 rounded border border-indigo-300 bg-indigo-50 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    맵에서 영역 선택
                  </button>
                </div>
                {drawingTarget === "edit" && (
                  <div className="flex items-center gap-1.5 rounded bg-indigo-50 px-2 py-1.5 text-xs text-indigo-600">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                    맵에서 드래그하여 영역을 선택하세요 (ESC: 취소)
                  </div>
                )}
                {editBboxWkt && (
                  <div className="rounded bg-white px-2 py-1 text-xs text-gray-500">
                    <div className="truncate">BBOX: {editBboxWkt}</div>
                    <div className="truncate">CENTER: {editCenterWkt}</div>
                  </div>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleUpdate(r.code)}
                    className="flex-1 rounded bg-blue-600 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    저장
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 rounded border py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div key={r.id} className="flex items-center justify-between rounded bg-white px-2 py-1.5 text-xs">
                <div>
                  <span className="font-medium text-gray-700">{r.name}</span>
                  <span className="ml-1 text-gray-400">({r.code})</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 mr-1">z{r.zoom_min}-{r.zoom_max}</span>
                  <button
                    onClick={() => startEdit(r)}
                    className="rounded px-1.5 py-0.5 text-blue-600 hover:bg-blue-50"
                    title="수정"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50"
                    title="삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ),
          )}
          {regions.length === 0 && (
            <div className="text-xs text-gray-400">등록된 지역이 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}
