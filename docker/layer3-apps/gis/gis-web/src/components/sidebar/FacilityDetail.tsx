import { useEffect, useState, useCallback, useRef } from "react";
import maplibregl, { type MapMouseEvent } from "maplibre-gl";
import { fetchFacility, type Facility } from "@/api/facilities";
import { useMapStore } from "@/stores/mapStore";

const PROP_LABELS: Record<string, string> = {
  // Common
  FSN: "관리번호", LAYER_CD: "레이어", SYM_KEY: "심볼",
  depth: "심도", diameter: "구경", material: "재질", status: "상태",
  slope: "경사", length: "연장", valve_type: "밸브종류",
  // Building
  bld_name: "건물명", bld_use: "용도", floors: "층수",
  // Parcel
  jimok: "지목", area_m2: "면적(㎡)",
  // Pipe properties
  KW_MA: "관 재질", KW_DI: "관경(mm)", KW_LENG: "연장(m)", KW_SL: "경사(%)",
  KW_HI_1: "시점심도(m)", KW_HI_2: "종점심도(m)", KW_YMD: "설치일",
  BOM_FSN: "시점맨홀", EOM_FSN: "종점맨홀",
  KW_TY: "관 종류", KW_CDN: "상태",
  // Manhole properties
  MH_MA: "재질", MH_SIZ: "규격", MH_HEP: "심도(m)", MH_INV: "관저고(m)",
  MH_CLF: "분류", MH_CDN: "상태", MH_YMD: "설치일",
  CVR_CDN: "뚜껑상태", CVR_SIZ: "뚜껑규격",
};

const HIDDEN_PROPS = new Set([
  "GUID", "SYM_ANG", "LEVEL", "OLD_ID", "PIC_A", "PIC_B",
  "DO_NUM", "MAKESW", "id", "fac_id", "type_name", "type_code",
]);

/** Priority properties shown first in popup */
const PRIORITY_PROPS = [
  "KW_DI", "diameter", "KW_MA", "material", "KW_LENG", "length",
  "KW_SL", "slope", "KW_HI_1", "depth", "KW_HI_2",
  "MH_SIZ", "MH_HEP", "MH_MA", "MH_CLF",
  "FSN", "KW_YMD", "MH_YMD",
];

const TYPE_COLORS: Record<string, string> = {
  PIPE_SEW: "#ef4444",
  PIPE_RAIN: "#3b82f6",
  PIPE_COMBINED: "#8b5cf6",
  PIPE_TREATMENT: "#27ae60",
  MANHOLE_SEW: "#f97316",
  MANHOLE_RAIN: "#06b6d4",
  INLET_RAIN: "#2ecc71",
  PUMP: "#10b981",
  TREATMENT: "#6366f1",
  VALVE: "#f59e0b",
};

const TYPE_NAMES: Record<string, string> = {
  PIPE_SEW: "하수관로",
  PIPE_RAIN: "우수관로",
  PIPE_COMBINED: "합류관로",
  PIPE_TREATMENT: "처리관로",
  MANHOLE_SEW: "하수맨홀",
  MANHOLE_RAIN: "우수맨홀",
  INLET_RAIN: "우수받이",
  PUMP: "펌프장",
  TREATMENT: "처리시설",
  VALVE: "밸브",
};

function sortedProps(props: Record<string, unknown>): [string, unknown][] {
  const entries = Object.entries(props).filter(
    ([k, v]) => v != null && v !== "" && !HIDDEN_PROPS.has(k),
  );
  const prioritized: [string, unknown][] = [];
  const rest: [string, unknown][] = [];
  const seen = new Set<string>();

  for (const key of PRIORITY_PROPS) {
    const entry = entries.find(([k]) => k === key);
    if (entry) {
      prioritized.push(entry);
      seen.add(key);
    }
  }
  for (const entry of entries) {
    if (!seen.has(entry[0])) rest.push(entry);
  }
  return [...prioritized, ...rest];
}

function buildPropsTable(props: Record<string, unknown>, typeCode?: string): string {
  const sorted = sortedProps(props).slice(0, 12);
  const rows = sorted
    .map(([k, v]) => {
      const label = PROP_LABELS[k] || k;
      return `<tr><td style="color:#64748b;padding:2px 8px 2px 0;white-space:nowrap;font-size:11px">${label}</td><td style="padding:2px 0;font-size:11px">${String(v)}</td></tr>`;
    })
    .join("");

  const typeColor = typeCode ? TYPE_COLORS[typeCode] : null;
  const typeName = typeCode ? TYPE_NAMES[typeCode] : null;
  const typeBadge =
    typeColor && typeName
      ? `<span style="display:inline-block;background:${typeColor}15;color:${typeColor};font-size:10px;padding:1px 6px;border-radius:3px;border:1px solid ${typeColor}40;margin-bottom:4px">${typeName}</span> `
      : "";

  return rows
    ? `${typeBadge}<table style="font-size:12px;line-height:1.6;border-collapse:collapse;width:100%">${rows}</table>`
    : typeBadge;
}

interface FacilityDetailProps {
  onDetailLoad?: () => void;
}

export default function FacilityDetail({ onDetailLoad }: FacilityDetailProps) {
  const map = useMapStore((s) => s.map);
  const setHighlightCoord = useMapStore((s) => s.setHighlightCoord);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const handleClick = useCallback(
    async (e: MapMouseEvent) => {
      if (!map) return;

      popupRef.current?.remove();

      const styleLayers = map.getStyle()?.layers;
      if (!styleLayers) return;
      const features = map.queryRenderedFeatures(e.point, {
        layers: styleLayers
          .filter((l) => l.id.startsWith("lyr-"))
          .map((l) => l.id),
      });

      if (features.length === 0) {
        setFacility(null);
        return;
      }

      const feat = features[0];
      const facilityId = feat.properties?.id;
      const facLabel = feat.properties?.fac_id ?? "시설물";
      const typeName = feat.properties?.type_name ?? "";
      const typeCode = feat.properties?.type_code ?? "";

      setHighlightCoord({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        label: facLabel,
      });

      const typeColor = TYPE_COLORS[typeCode] ?? "#64748b";
      const typeDisplayName = TYPE_NAMES[typeCode] ?? typeName;

      const popup = new maplibregl.Popup({ closeOnClick: true, maxWidth: "300px", className: "facility-popup" })
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-size:13px;line-height:1.5">
            <div style="font-weight:600;margin-bottom:2px">${facLabel}</div>
            ${typeDisplayName ? `<span style="display:inline-block;background:${typeColor}15;color:${typeColor};font-size:10px;padding:1px 6px;border-radius:3px;border:1px solid ${typeColor}40;margin-bottom:2px">${typeDisplayName}</span>` : ""}
            ${facilityId ? '<div style="color:#94a3b8;font-size:11px;margin-top:2px">상세 조회 중...</div>' : ""}
          </div>`,
        )
        .addTo(map);
      popupRef.current = popup;

      if (!facilityId) {
        setFacility(null);
        return;
      }

      setLoading(true);
      try {
        const data = await fetchFacility(Number(facilityId));
        setFacility(data);
        onDetailLoad?.();

        const propsTable = buildPropsTable(data.properties, typeCode);
        popup.setHTML(
          `<div style="font-size:13px;line-height:1.5">
            <div style="font-weight:600;margin-bottom:4px">${data.fac_id ?? "시설물"}</div>
            ${data.year ? `<div style="display:inline-block;background:#eff6ff;color:#2563eb;font-size:10px;padding:1px 6px;border-radius:3px;margin-bottom:4px;margin-right:4px">설치 ${data.year}년</div>` : ""}
            ${propsTable}
          </div>`,
        );
      } catch {
        setFacility(null);
        popup.setHTML('<div style="font-size:13px;color:#e53e3e">조회 실패</div>');
      } finally {
        setLoading(false);
      }
    },
    [map, onDetailLoad, setHighlightCoord],
  );

  useEffect(() => {
    if (!map) return;
    map.on("click", handleClick);

    const handleMouseEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const handleMouseLeave = () => { map.getCanvas().style.cursor = ""; };
    const trackedLayers = new Set<string>();

    const addCursorHandlers = () => {
      const style = map.getStyle();
      if (!style?.layers) return;
      style.layers
        .filter((l) => l.id.startsWith("lyr-") && !trackedLayers.has(l.id))
        .forEach((l) => {
          map.on("mouseenter", l.id, handleMouseEnter);
          map.on("mouseleave", l.id, handleMouseLeave);
          trackedLayers.add(l.id);
        });
    };

    map.on("styledata", addCursorHandlers);

    return () => {
      try {
        map.off("click", handleClick);
        map.off("styledata", addCursorHandlers);
        for (const id of trackedLayers) {
          map.off("mouseenter", id, handleMouseEnter);
          map.off("mouseleave", id, handleMouseLeave);
        }
      } catch {
        // Map may already be removed
      }
      trackedLayers.clear();
      popupRef.current?.remove();
    };
  }, [map, handleClick]);

  if (loading) {
    return <div className="p-3 text-sm text-gray-500">조회 중...</div>;
  }

  if (!facility) return null;

  const typeCode = (facility.properties?.type_code as string) ?? "";
  const typeColor = TYPE_COLORS[typeCode] ?? "#64748b";
  const typeName = TYPE_NAMES[typeCode] ?? (facility.properties?.type_name as string) ?? "";

  return (
    <div className="border-t p-3">
      <h3 className="mb-2 text-xs font-semibold text-gray-600 uppercase">
        시설물 정보
      </h3>
      <div className="space-y-1 text-sm">
        {facility.fac_id && (
          <div>
            <span className="text-gray-500">관리번호: </span>
            {facility.fac_id}
          </div>
        )}
        {typeName && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: typeColor }}
            />
            <span className="text-gray-500">종류: </span>
            <span>{typeName}</span>
          </div>
        )}
        {facility.year && (
          <div>
            <span className="text-gray-500">설치연도: </span>
            {facility.year}
          </div>
        )}
        {sortedProps(facility.properties).map(([key, val]) => (
          <div key={key}>
            <span className="text-gray-500">{PROP_LABELS[key] || key}: </span>
            {String(val)}
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          setFacility(null);
          popupRef.current?.remove();
        }}
        className="mt-2 text-xs text-gray-400 hover:text-gray-600"
      >
        닫기
      </button>
    </div>
  );
}
