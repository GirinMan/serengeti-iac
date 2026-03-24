import { useCallback, useState } from "react";
import { useMapStore } from "@/stores/mapStore";
import { useLayerStore } from "@/stores/layerStore";
import { useAuthStore } from "@/stores/authStore";

type ExportMode = "simple" | "print";

function getTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function getDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TYPE_LABELS: Record<string, string> = {
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

/** Get the style color for a layer */
function getLayerColor(style: Record<string, unknown>): string {
  if (!style) return "#888888";
  const c = style["fill-color"] ?? style["line-color"] ?? style["circle-color"];
  if (typeof c === "string") return c;
  if (Array.isArray(c) && c[0] === "match" && c.length >= 4) return c[3] as string;
  return "#888888";
}

function getLayerShape(style: Record<string, unknown>): "fill" | "line" | "circle" {
  if (style?.["fill-color"]) return "fill";
  if (style?.["circle-color"]) return "circle";
  return "line";
}

interface LegendSubItem {
  label: string;
  color: string;
}

function getMatchSubItems(style: Record<string, unknown>): LegendSubItem[] | null {
  if (!style) return null;
  const c = style["fill-color"] ?? style["line-color"] ?? style["circle-color"];
  if (!Array.isArray(c) || c[0] !== "match" || c.length < 6) return null;
  const items: LegendSubItem[] = [];
  for (let i = 2; i < c.length - 1; i += 2) {
    items.push({ label: String(c[i]), color: c[i + 1] as string });
  }
  return items.length > 0 ? items : null;
}

interface PrintLegendEntry {
  name: string;
  color: string;
  shape: "fill" | "line" | "circle";
  subItems?: LegendSubItem[];
}

// --- Scale bar helpers ---

/** Nice round scale bar distances in meters */
const SCALE_STEPS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000,
  50000, 100000, 200000, 500000, 1000000,
];

/** Calculate meters per pixel at given latitude and zoom */
function metersPerPixel(lat: number, zoom: number): number {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
}

/** Pick a nice scale bar width and label */
function computeScaleBar(
  lat: number,
  zoom: number,
  maxBarPx: number,
): { widthPx: number; meters: number; label: string } {
  const mpp = metersPerPixel(lat, zoom);
  const maxMeters = mpp * maxBarPx;

  let best = SCALE_STEPS[0];
  for (const step of SCALE_STEPS) {
    if (step <= maxMeters) best = step;
    else break;
  }

  const widthPx = Math.round(best / mpp);
  const label = best >= 1000 ? `${best / 1000} km` : `${best} m`;
  return { widthPx, meters: best, label };
}

/** Draw a scale bar on the canvas */
function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lat: number,
  zoom: number,
) {
  const { widthPx, label } = computeScaleBar(lat, zoom, 150);
  const barH = 6;

  // Bar background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 1, y - 14, widthPx + 2, barH + 18);

  // Bar with alternating segments
  const segments = 2;
  const segW = widthPx / segments;
  for (let i = 0; i < segments; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#1f2937" : "#ffffff";
    ctx.fillRect(x + i * segW, y, segW, barH);
  }

  // Bar border
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, widthPx, barH);

  // Tick marks
  for (let i = 0; i <= segments; i++) {
    const tx = x + i * segW;
    ctx.beginPath();
    ctx.moveTo(tx, y - 2);
    ctx.lineTo(tx, y + barH + 2);
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = "#1f2937";
  ctx.font = "11px 'Pretendard', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + widthPx / 2, y - 4);
}

/** Draw a north arrow on the canvas */
function drawNorthArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const half = size / 2;

  // Arrow body (filled triangle pointing up)
  ctx.fillStyle = "#1f2937";
  ctx.beginPath();
  ctx.moveTo(cx, cy - half);
  ctx.lineTo(cx + half * 0.35, cy + half * 0.5);
  ctx.lineTo(cx, cy + half * 0.2);
  ctx.closePath();
  ctx.fill();

  // Right half (lighter)
  ctx.fillStyle = "#9ca3af";
  ctx.beginPath();
  ctx.moveTo(cx, cy - half);
  ctx.lineTo(cx - half * 0.35, cy + half * 0.5);
  ctx.lineTo(cx, cy + half * 0.2);
  ctx.closePath();
  ctx.fill();

  // "N" label
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 12px 'Pretendard', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("N", cx, cy - half - 2);
  ctx.textBaseline = "alphabetic";
}

const ROLE_LABELS: Record<string, string> = {
  admin: "관리자",
  editor: "편집자",
  viewer: "뷰어",
};

/** Render a print layout canvas with map image, title, legend, scale bar, north arrow, date */
function renderPrintCanvas(
  mapCanvas: HTMLCanvasElement,
  layers: PrintLegendEntry[],
  regionName: string,
  mapInfo: { lat: number; zoom: number },
  userName?: string | null,
  userRole?: string | null,
): HTMLCanvasElement {
  const margin = 40;
  const headerH = 60;
  const footerH = 40;
  const legendW = layers.length > 0 ? 200 : 0;
  const mapW = mapCanvas.width;
  const mapH = mapCanvas.height;

  const totalW = margin * 2 + mapW + (legendW > 0 ? margin + legendW : 0);
  const totalH = margin + headerH + mapH + footerH + margin;

  const canvas = document.createElement("canvas");
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, totalW, totalH);

  // Title
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 24px 'Pretendard', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    regionName ? `${regionName} 지하시설물 현황` : "GIS 지하시설물 현황",
    margin,
    margin + 36,
  );

  // Map border
  const mapX = margin;
  const mapY = margin + headerH;
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX - 0.5, mapY - 0.5, mapW + 1, mapH + 1);

  // Map image
  ctx.drawImage(mapCanvas, mapX, mapY);

  // Scale bar (bottom-left of map)
  drawScaleBar(ctx, mapX + 16, mapY + mapH - 20, mapInfo.lat, mapInfo.zoom);

  // North arrow (top-right of map)
  drawNorthArrow(ctx, mapX + mapW - 30, mapY + 30, 36);

  // Legend (right side)
  if (legendW > 0 && layers.length > 0) {
    const legX = margin + mapW + margin;
    const legY = mapY;

    ctx.fillStyle = "#374151";
    ctx.font = "bold 14px 'Pretendard', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("범례", legX, legY + 18);

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(legX, legY + 26);
    ctx.lineTo(legX + legendW - 20, legY + 26);
    ctx.stroke();

    const drawSymbol = (x: number, y: number, shape: string, color: string) => {
      ctx.fillStyle = color;
      if (shape === "fill") {
        ctx.fillRect(x, y - 8, 16, 12);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y - 8, 16, 12);
      } else if (shape === "circle") {
        ctx.beginPath();
        ctx.arc(x + 8, y - 2, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y - 2);
        ctx.lineTo(x + 16, y - 2);
        ctx.stroke();
      }
    };

    let offsetY = legY + 44;
    for (const layer of layers) {
      if (layer.subItems && layer.subItems.length > 0) {
        // Layer group header
        ctx.fillStyle = "#6b7280";
        ctx.font = "bold 11px 'Pretendard', sans-serif";
        ctx.fillText(layer.name, legX, offsetY);
        offsetY += 20;

        // Sub-items
        ctx.font = "11px 'Pretendard', sans-serif";
        for (const sub of layer.subItems) {
          drawSymbol(legX + 8, offsetY, layer.shape, sub.color);
          ctx.fillStyle = "#374151";
          ctx.fillText(TYPE_LABELS[sub.label] ?? sub.label, legX + 32, offsetY);
          offsetY += 20;
        }
        offsetY += 4;
      } else {
        // Simple layer
        ctx.font = "12px 'Pretendard', sans-serif";
        drawSymbol(legX, offsetY, layer.shape, layer.color);
        ctx.fillStyle = "#374151";
        ctx.fillText(layer.name, legX + 24, offsetY);
        offsetY += 24;
      }
    }
  }

  // Footer: date + user + attribution
  const footerY = mapY + mapH + 24;
  ctx.fillStyle = "#9ca3af";
  ctx.font = "11px 'Pretendard', sans-serif";
  ctx.textAlign = "left";

  const dateText = `출력일: ${getDateString()}`;
  if (userName) {
    const roleLabel = userRole ? ROLE_LABELS[userRole] ?? userRole : "";
    const userText = roleLabel ? `${userName} (${roleLabel})` : userName;
    ctx.fillText(`${dateText}  |  출력자: ${userText}`, margin, footerY);
  } else {
    ctx.fillText(`${dateText}  |  출력자: 비인증 사용자`, margin, footerY);
  }

  ctx.textAlign = "right";
  ctx.fillText("© OpenStreetMap contributors", margin + mapW, footerY);

  return canvas;
}

export default function MapExport() {
  const map = useMapStore((s) => s.map);
  const region = useMapStore((s) => s.region);
  const layers = useLayerStore((s) => s.layers);
  const visibleIds = useLayerStore((s) => s.visibleIds);
  const user = useAuthStore((s) => s.user);
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const doExport = useCallback(
    (mode: ExportMode) => {
      if (!map) return;
      setExporting(true);
      setShowMenu(false);

      map.once("render", () => {
        try {
          const mapCanvas = map.getCanvas();
          const filename = `gis-map-${getTimestamp()}.png`;

          if (mode === "simple") {
            const dataUrl = mapCanvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = filename;
            link.href = dataUrl;
            link.click();
          } else {
            // Print layout with legend
            const visibleLayers: PrintLegendEntry[] = layers
              .filter((l) => visibleIds.has(l.id) && l.style)
              .map((l) => ({
                name: l.name,
                color: getLayerColor(l.style),
                shape: getLayerShape(l.style),
                subItems: getMatchSubItems(l.style) ?? undefined,
              }));

            const center = map.getCenter();
            const mapInfo = {
              lat: center.lat,
              zoom: map.getZoom(),
            };
            const printCanvas = renderPrintCanvas(
              mapCanvas,
              visibleLayers,
              region?.name || "",
              mapInfo,
              user?.name ?? user?.username ?? null,
              user?.role ?? null,
            );
            const dataUrl = printCanvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = filename.replace(".png", "-print.png");
            link.href = dataUrl;
            link.click();
          }
        } catch {
          // Canvas tainted or export failed
        } finally {
          setExporting(false);
        }
      });

      map.triggerRepaint();
    },
    [map, layers, visibleIds, region, user],
  );

  if (!map) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
        className="rounded bg-white px-3 py-2.5 text-sm font-medium shadow hover:bg-gray-50 disabled:opacity-50 md:px-2 md:py-1.5 md:text-xs"
        title="현재 지도를 PNG로 저장"
      >
        <span className="flex items-center gap-1">
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 11v3h12v-3" />
            <path d="M8 2v8M5 7l3 3 3-3" />
          </svg>
          {exporting ? "저장 중..." : "내보내기"}
        </span>
      </button>

      {showMenu && (
        <div className="absolute top-full left-0 mt-1 w-36 rounded bg-white py-1 shadow-lg">
          <button
            onClick={() => doExport("simple")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="10" height="10" rx="1" />
            </svg>
            지도만 저장
          </button>
          <button
            onClick={() => doExport("print")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="10" height="10" rx="1" />
              <path d="M1 3h10M8 1v10" />
            </svg>
            인쇄 레이아웃
          </button>
        </div>
      )}
    </div>
  );
}
