import { useEffect, useRef } from "react";
import { Marker } from "maplibre-gl";
import { useMapStore } from "@/stores/mapStore";

export default function HighlightMarker() {
  const map = useMapStore((s) => s.map);
  const highlightCoord = useMapStore((s) => s.highlightCoord);
  const setHighlightCoord = useMapStore((s) => s.setHighlightCoord);
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    const onClick = () => setHighlightCoord(null);
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [map, setHighlightCoord]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (!map || !highlightCoord) return;

    const el = document.createElement("div");
    el.className = "highlight-marker";

    const label = highlightCoord.label;
    const labelHtml = label
      ? `<div class="highlight-marker-label">${label.length > 30 ? label.slice(0, 30) + "…" : label}</div>`
      : "";

    el.innerHTML = `
      ${labelHtml}
      <div class="highlight-marker-ping"></div>
      <div class="highlight-marker-dot"></div>
    `;

    const marker = new Marker({ element: el, anchor: "center" })
      .setLngLat([highlightCoord.lng, highlightCoord.lat])
      .addTo(map);

    markerRef.current = marker;

    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, highlightCoord]);

  return (
    <style>{`
      .highlight-marker {
        position: relative;
        width: 24px;
        height: 24px;
        cursor: pointer;
      }
      .highlight-marker-label {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 6px;
        padding: 4px 8px;
        background: #1e293b;
        color: #fff;
        font-size: 12px;
        line-height: 1.3;
        white-space: nowrap;
        border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        pointer-events: none;
      }
      .highlight-marker-label::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -4px;
        border: 4px solid transparent;
        border-top-color: #1e293b;
      }
      .highlight-marker-dot {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 12px;
        height: 12px;
        margin: -6px 0 0 -6px;
        background: #2563eb;
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      }
      .highlight-marker-ping {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 24px;
        height: 24px;
        margin: -12px 0 0 -12px;
        background: rgba(37, 99, 235, 0.3);
        border-radius: 50%;
        animation: highlight-ping 1.5s ease-out infinite;
      }
      @keyframes highlight-ping {
        0% { transform: scale(1); opacity: 0.6; }
        100% { transform: scale(2.5); opacity: 0; }
      }
    `}</style>
  );
}
