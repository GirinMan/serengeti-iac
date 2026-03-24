import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap, MapMouseEvent, GeoJSONSource } from "maplibre-gl";
import { useMapStore } from "@/stores/mapStore";

type MeasureMode = "none" | "distance" | "area";

interface Point {
  lng: number;
  lat: number;
}

// --- Geo math (no external deps) ---

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversine(a: Point, b: Point): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function totalDistance(pts: Point[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    d += haversine(pts[i - 1], pts[i]);
  }
  return d;
}

/** Spherical excess formula for polygon area on a sphere */
function sphericalArea(pts: Point[]): number {
  if (pts.length < 3) return 0;
  const R = 6371000;
  const ring = pts.map((p) => ({ lat: toRad(p.lat), lng: toRad(p.lng) }));
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    sum +=
      (ring[j].lng - ring[i].lng) *
      (2 + Math.sin(ring[i].lat) + Math.sin(ring[j].lat));
  }
  return Math.abs((sum * R * R) / 2);
}

function formatDistance(m: number): string {
  if (m < 1000) return `${m.toFixed(1)} m`;
  return `${(m / 1000).toFixed(3)} km`;
}

function formatDistanceShort(m: number): string {
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function formatArea(m2: number): string {
  if (m2 < 10000) return `${m2.toFixed(1)} m²`;
  if (m2 < 1000000) return `${(m2 / 10000).toFixed(2)} ha`;
  return `${(m2 / 1000000).toFixed(3)} km²`;
}

function centroid(pts: Point[]): Point {
  const n = pts.length;
  let lng = 0, lat = 0;
  for (const p of pts) { lng += p.lng; lat += p.lat; }
  return { lng: lng / n, lat: lat / n };
}

// --- Source/layer IDs ---
const SRC_LINE = "measure-line";
const SRC_POLY = "measure-poly";
const SRC_PTS = "measure-pts";
const SRC_LABELS = "measure-labels";
const LYR_LINE = "measure-line-lyr";
const LYR_POLY = "measure-poly-lyr";
const LYR_PTS = "measure-pts-lyr";
const LYR_LABELS = "measure-labels-lyr";
const LYR_LABELS_BG = "measure-labels-bg-lyr";

function addMeasureLayers(map: MaplibreMap) {
  if (!map.getSource(SRC_LINE)) {
    map.addSource(SRC_LINE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getSource(SRC_POLY)) {
    map.addSource(SRC_POLY, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getSource(SRC_PTS)) {
    map.addSource(SRC_PTS, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getSource(SRC_LABELS)) {
    map.addSource(SRC_LABELS, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer(LYR_POLY)) {
    map.addLayer({
      id: LYR_POLY,
      type: "fill",
      source: SRC_POLY,
      paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15 },
    });
  }
  if (!map.getLayer(LYR_LINE)) {
    map.addLayer({
      id: LYR_LINE,
      type: "line",
      source: SRC_LINE,
      paint: {
        "line-color": "#3b82f6",
        "line-width": 2.5,
        "line-dasharray": [4, 3],
      },
    });
  }
  if (!map.getLayer(LYR_PTS)) {
    map.addLayer({
      id: LYR_PTS,
      type: "circle",
      source: SRC_PTS,
      paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-stroke-color": "#3b82f6",
        "circle-stroke-width": 2,
      },
    });
  }
  // Label background (text halo handles this, but we add as a separate layer for better control)
  if (!map.getLayer(LYR_LABELS_BG)) {
    map.addLayer({
      id: LYR_LABELS_BG,
      type: "symbol",
      source: SRC_LABELS,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 11,
        "text-offset": [0, -1.2],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "rgba(0,0,0,0)",
        "text-halo-color": "#ffffff",
        "text-halo-width": 3,
      },
      filter: ["==", ["get", "type"], "segment"],
    });
  }
  if (!map.getLayer(LYR_LABELS)) {
    map.addLayer({
      id: LYR_LABELS,
      type: "symbol",
      source: SRC_LABELS,
      layout: {
        "text-field": ["get", "label"],
        "text-size": ["case", ["==", ["get", "type"], "area"], 13, 11],
        "text-offset": [
          "case",
          ["==", ["get", "type"], "area"],
          ["literal", [0, 0]],
          ["literal", [0, -1.2]],
        ],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-font": ["Open Sans Regular"],
      },
      paint: {
        "text-color": [
          "case",
          ["==", ["get", "type"], "area"],
          "#1d4ed8",
          "#1e40af",
        ],
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
      },
    });
  }
}

function removeMeasureLayers(map: MaplibreMap) {
  try {
    const layers = [LYR_PTS, LYR_LABELS, LYR_LABELS_BG, LYR_LINE, LYR_POLY];
    for (const lyr of layers) {
      if (map.getLayer(lyr)) map.removeLayer(lyr);
    }
    const sources = [SRC_PTS, SRC_LABELS, SRC_LINE, SRC_POLY];
    for (const src of sources) {
      if (map.getSource(src)) map.removeSource(src);
    }
  } catch {
    // Map may already be destroyed
  }
}

function buildLabelFeatures(pts: Point[], mode: MeasureMode): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = [];

  if (pts.length < 2) return features;

  // Segment midpoint labels with distance
  let cumulative = 0;
  for (let i = 1; i < pts.length; i++) {
    const segDist = haversine(pts[i - 1], pts[i]);
    cumulative += segDist;
    const midLng = (pts[i - 1].lng + pts[i].lng) / 2;
    const midLat = (pts[i - 1].lat + pts[i].lat) / 2;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [midLng, midLat] },
      properties: {
        label: formatDistanceShort(segDist),
        type: "segment",
      },
    });
  }

  // Cumulative distance at each vertex (skip first = 0)
  if (mode === "distance" && pts.length >= 2) {
    let cum = 0;
    for (let i = 1; i < pts.length; i++) {
      cum += haversine(pts[i - 1], pts[i]);
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [pts[i].lng, pts[i].lat] },
        properties: {
          label: `총 ${formatDistanceShort(cum)}`,
          type: "cumulative",
        },
      });
    }
  }

  // Area label at centroid
  if (mode === "area" && pts.length >= 3) {
    const c = centroid(pts);
    const area = sphericalArea(pts);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      properties: {
        label: formatArea(area),
        type: "area",
      },
    });
  }

  return features;
}

function updateSources(map: MaplibreMap, pts: Point[], mode: MeasureMode, cursor: Point | null) {
  const allPts = cursor ? [...pts, cursor] : pts;
  const coords = allPts.map((p) => [p.lng, p.lat]);

  // Points
  (map.getSource(SRC_PTS) as GeoJSONSource)?.setData({
    type: "FeatureCollection",
    features: allPts.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      properties: {},
    })),
  });

  // Line
  (map.getSource(SRC_LINE) as GeoJSONSource)?.setData({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: coords.length >= 2 ? coords : [],
    },
    properties: {},
  });

  // Polygon (only in area mode with 3+ points)
  if (mode === "area" && coords.length >= 3) {
    (map.getSource(SRC_POLY) as GeoJSONSource)?.setData({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[...coords, coords[0]]],
      },
      properties: {},
    });
  } else {
    (map.getSource(SRC_POLY) as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: [],
    });
  }

  // Labels
  (map.getSource(SRC_LABELS) as GeoJSONSource)?.setData({
    type: "FeatureCollection",
    features: buildLabelFeatures(allPts, mode),
  });
}

export default function MeasureTool() {
  const map = useMapStore((s) => s.map);
  const [mode, setMode] = useState<MeasureMode>("none");
  const [points, setPoints] = useState<Point[]>([]);
  const [, setCursorPt] = useState<Point | null>(null);
  const [result, setResult] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const modeRef = useRef<MeasureMode>("none");
  const pointsRef = useRef<Point[]>([]);

  // Keep refs in sync
  modeRef.current = mode;
  pointsRef.current = points;

  const computeResult = useCallback((pts: Point[], m: MeasureMode): string => {
    if (m === "distance" && pts.length >= 2) {
      return formatDistance(totalDistance(pts));
    }
    if (m === "area" && pts.length >= 3) {
      return `${formatArea(sphericalArea(pts))} (둘레: ${formatDistance(totalDistance([...pts, pts[0]]))})`;
    }
    return "";
  }, []);

  const clearMeasure = useCallback(() => {
    setPoints([]);
    setCursorPt(null);
    setResult("");
    setCopied(false);
    if (map) {
      updateSources(map, [], "none", null);
    }
  }, [map]);

  const startMode = useCallback(
    (m: MeasureMode) => {
      clearMeasure();
      setMode(m);
      if (map) {
        map.getCanvas().style.cursor = m === "none" ? "" : "crosshair";
        if (m !== "none") addMeasureLayers(map);
      }
    },
    [map, clearMeasure],
  );

  const stopMode = useCallback(() => {
    setMode("none");
    clearMeasure();
    if (map) {
      map.getCanvas().style.cursor = "";
      removeMeasureLayers(map);
    }
  }, [map, clearMeasure]);

  const undoLastPoint = useCallback(() => {
    if (pointsRef.current.length === 0) return;
    const next = pointsRef.current.slice(0, -1);
    setPoints(next);
    setCopied(false);
    if (map) {
      updateSources(map, next, modeRef.current, null);
      setResult(computeResult(next, modeRef.current));
    }
  }, [map, computeResult]);

  const copyResult = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [result]);

  // Map event handlers
  useEffect(() => {
    if (!map) return;

    const onClick = (e: MapMouseEvent) => {
      if (modeRef.current === "none") return;
      const pt: Point = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      const next = [...pointsRef.current, pt];
      setPoints(next);
      setCopied(false);
      updateSources(map, next, modeRef.current, null);

      if (modeRef.current === "distance") {
        setResult(formatDistance(totalDistance(next)));
      } else if (modeRef.current === "area") {
        if (next.length >= 3) {
          setResult(
            `${formatArea(sphericalArea(next))} (둘레: ${formatDistance(totalDistance([...next, next[0]]))})`
          );
        }
      }
    };

    const onDblClick = (e: MapMouseEvent) => {
      if (modeRef.current === "none") return;
      e.preventDefault();
      // Finalize: keep result visible, stop cursor tracking
      map.getCanvas().style.cursor = "";
      setCursorPt(null);
      setMode("none");
    };

    const onMouseMove = (e: MapMouseEvent) => {
      if (modeRef.current === "none" || pointsRef.current.length === 0) return;
      const pt: Point = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      setCursorPt(pt);
      updateSources(map, pointsRef.current, modeRef.current, pt);

      const allPts = [...pointsRef.current, pt];
      if (modeRef.current === "distance") {
        setResult(formatDistance(totalDistance(allPts)));
      } else if (modeRef.current === "area" && allPts.length >= 3) {
        setResult(
          `${formatArea(sphericalArea(allPts))} (둘레: ${formatDistance(totalDistance([...allPts, allPts[0]]))})`
        );
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (modeRef.current === "none") return;
      if (e.key === "Escape") {
        stopMode();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undoLastPoint();
      }
    };

    map.on("click", onClick);
    map.on("dblclick", onDblClick);
    map.on("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
      map.off("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [map, stopMode, undoLastPoint]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map) {
        try {
          map.getCanvas().style.cursor = "";
          removeMeasureLayers(map);
        } catch {
          // Map may be destroyed
        }
      }
    };
  }, [map]);

  if (!map) return null;

  const isActive = mode !== "none";

  return (
    <div className="absolute top-14 left-28 z-10 flex flex-col gap-1 md:top-3">
      {/* Toolbar */}
      <div className="flex gap-1 rounded bg-white shadow">
        <button
          onClick={() => (mode === "distance" ? stopMode() : startMode("distance"))}
          className={`flex items-center gap-1 rounded-l px-3 py-2.5 text-sm font-medium md:px-2 md:py-1.5 md:text-xs ${
            mode === "distance"
              ? "bg-blue-500 text-white"
              : "text-gray-700 hover:bg-gray-50"
          }`}
          title="거리 측정 (ESC로 취소)"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 14L14 2" />
            <path d="M2 14L2 10M2 14L6 14" />
            <path d="M14 2L14 6M14 2L10 2" />
          </svg>
          거리
        </button>
        <button
          onClick={() => (mode === "area" ? stopMode() : startMode("area"))}
          className={`flex items-center gap-1 rounded-r px-3 py-2.5 text-sm font-medium md:px-2 md:py-1.5 md:text-xs ${
            mode === "area"
              ? "bg-blue-500 text-white"
              : "text-gray-700 hover:bg-gray-50"
          }`}
          title="면적 측정 (ESC로 취소)"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="2,14 8,2 14,14" />
          </svg>
          면적
        </button>
      </div>

      {/* Result panel */}
      {(isActive || result) && (
        <div className="rounded bg-white/95 px-2.5 py-1.5 text-xs shadow backdrop-blur-sm">
          {isActive && !result && (
            <span className="text-gray-400">지도를 클릭하세요</span>
          )}
          {result && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-medium text-gray-800">{result}</span>
              <button
                onClick={copyResult}
                className="text-gray-400 hover:text-blue-500"
                title="결과 복사"
              >
                {copied ? (
                  <svg className="h-3 w-3 text-green-500" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 6l3 3 5-6" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="4" y="4" width="7" height="7" rx="1" />
                    <path d="M8 4V2a1 1 0 00-1-1H2a1 1 0 00-1 1v5a1 1 0 001 1h2" />
                  </svg>
                )}
              </button>
              <button
                onClick={stopMode}
                className="text-gray-400 hover:text-gray-600"
                title="측정 초기화"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            </div>
          )}
          {isActive && (
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-400">
              <span>더블클릭: 완료 · ESC: 취소</span>
              {points.length > 0 && (
                <button
                  onClick={undoLastPoint}
                  className="text-blue-400 hover:text-blue-600"
                  title="마지막 포인트 삭제 (Ctrl+Z)"
                >
                  ↩ 되돌리기
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
