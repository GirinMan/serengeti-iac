import { useEffect, useRef } from "react";
import { useMapStore } from "@/stores/mapStore";
import { useLayerStore } from "@/stores/layerStore";

const TILE_BASE_URL = import.meta.env.VITE_TILE_BASE_URL ?? "/tiles";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const CUSTOM_GEOJSON_CATEGORY = "custom_geojson";

function tileUrlForLayer(tileUrl: string | null, sourceTable: string | null): string {
  let url = "";
  if (tileUrl) {
    url = tileUrl.startsWith("/") ? `${TILE_BASE_URL}${tileUrl}` : tileUrl;
  } else if (sourceTable) {
    url = `${TILE_BASE_URL}/${sourceTable}/{z}/{x}/{y}.pbf`;
  }
  // MapLibre Web Workers cannot resolve relative URLs — ensure absolute
  if (url && url.startsWith("/")) {
    url = `${window.location.origin}${url}`;
  }
  return url;
}

function resolveLayerType(style: Record<string, unknown>): string {
  if (style.type) return style.type as string;
  if (style["fill-color"]) return "fill";
  if (style["circle-color"]) return "circle";
  if (style["line-color"]) return "line";
  return "line";
}

function buildPaintProps(
  layerType: string,
  style: Record<string, unknown>,
): Record<string, unknown> {
  const paint: Record<string, unknown> = {};

  if (layerType === "fill") {
    paint["fill-color"] = style["fill-color"] ?? "#3388ff";
    paint["fill-opacity"] = style["fill-opacity"] ?? 0.5;
    const outlineColor = style["fill-outline-color"] ?? style["stroke-color"];
    if (outlineColor) paint["fill-outline-color"] = outlineColor;
  } else if (layerType === "line") {
    paint["line-color"] = style["line-color"] ?? "#3388ff";
    paint["line-width"] = style["line-width"] ?? 2;
    if (style["line-opacity"] != null) paint["line-opacity"] = style["line-opacity"];
  } else if (layerType === "circle") {
    paint["circle-color"] = style["circle-color"] ?? "#ff6600";
    paint["circle-radius"] = style["circle-radius"] ?? 5;
    paint["circle-stroke-width"] = style["circle-stroke-width"] ?? 1;
    paint["circle-stroke-color"] = style["circle-stroke-color"] ?? "#fff";
  } else if (layerType === "symbol") {
    paint["text-color"] = style["text-color"] ?? "#333";
    if (style["text-halo-color"] != null) paint["text-halo-color"] = style["text-halo-color"];
    if (style["text-halo-width"] != null) paint["text-halo-width"] = style["text-halo-width"];
    if (style["text-opacity"] != null) paint["text-opacity"] = style["text-opacity"];
  }

  return paint;
}

function buildLayoutProps(
  layerType: string,
  style: Record<string, unknown>,
  visible: boolean,
): Record<string, unknown> {
  const layout: Record<string, unknown> = {
    visibility: visible ? "visible" : "none",
  };

  if (layerType === "line") {
    layout["line-cap"] = style["line-cap"] ?? "round";
    layout["line-join"] = style["line-join"] ?? "round";
  } else if (layerType === "symbol") {
    if (style["text-field"] != null) layout["text-field"] = style["text-field"];
    layout["text-size"] = style["text-size"] ?? 11;
    if (style["text-font"] != null) layout["text-font"] = style["text-font"];
    if (style["text-anchor"] != null) layout["text-anchor"] = style["text-anchor"];
    if (style["text-offset"] != null) layout["text-offset"] = style["text-offset"];
    if (style["text-max-width"] != null) layout["text-max-width"] = style["text-max-width"];
    if (style["text-allow-overlap"] != null) layout["text-allow-overlap"] = style["text-allow-overlap"];
    if (style["symbol-placement"] != null) layout["symbol-placement"] = style["symbol-placement"];
  }

  return layout;
}

export default function LayerManager() {
  const map = useMapStore((s) => s.map);
  const layers = useLayerStore((s) => s.layers);
  const visibleIds = useLayerStore((s) => s.visibleIds);
  const opacityMap = useLayerStore((s) => s.opacityMap);
  const addedLayersRef = useRef<Set<string>>(new Set());
  const layerTypesRef = useRef<Map<string, string>>(new Map());
  const baseOpacityRef = useRef<Map<string, number>>(new Map());
  const appliedStylesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!map) return;

    // Remove layers that are no longer in the layers array (e.g. deleted custom layers)
    const currentLayerIds = new Set(layers.map((l) => `lyr-${l.code}`));
    for (const existingId of Array.from(addedLayersRef.current)) {
      if (!currentLayerIds.has(existingId)) {
        const sourceId = existingId.replace("lyr-", "src-");
        try {
          if (map.getLayer(existingId)) map.removeLayer(existingId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        } catch { /* ignore */ }
        addedLayersRef.current.delete(existingId);
        layerTypesRef.current.delete(existingId);
        baseOpacityRef.current.delete(existingId);
        appliedStylesRef.current.delete(existingId);
      }
    }

    for (const layer of layers) {
      const sourceId = `src-${layer.code}`;
      const layerId = `lyr-${layer.code}`;
      const visible = visibleIds.has(layer.id);
      const isCustomGeoJSON = layer.category === CUSTOM_GEOJSON_CATEGORY;

      if (isCustomGeoJSON) {
        // Custom GeoJSON layer: use GeoJSON source
        if (!map.getSource(sourceId)) {
          if (!layer.tile_url) continue;
          const geojsonUrl = `${window.location.origin}${API_BASE_URL}${layer.tile_url}`;
          map.addSource(sourceId, {
            type: "geojson",
            data: geojsonUrl,
          });
        }

        const style = (layer.style ?? {}) as Record<string, unknown>;
        const styleKey = JSON.stringify(style);

        if (!map.getLayer(layerId)) {
          const layerType = resolveLayerType(style);
          const paintProps = buildPaintProps(layerType, style);
          const layoutProps = buildLayoutProps(layerType, style, visible);

          const geojsonLayerDef: Record<string, unknown> = {
            id: layerId,
            type: layerType,
            source: sourceId,
            paint: paintProps,
            layout: layoutProps,
          };
          if (style["filter"] != null) geojsonLayerDef["filter"] = style["filter"];

          map.addLayer(geojsonLayerDef as Parameters<typeof map.addLayer>[0]);

          addedLayersRef.current.add(layerId);
          layerTypesRef.current.set(layerId, layerType);
          appliedStylesRef.current.set(layerId, styleKey);
          if (layerType === "fill") baseOpacityRef.current.set(layerId, (style["fill-opacity"] as number) ?? 0.5);
          else if (layerType === "line") baseOpacityRef.current.set(layerId, (style["line-opacity"] as number) ?? 1);
          else if (layerType === "circle") baseOpacityRef.current.set(layerId, 1);
          else if (layerType === "symbol") baseOpacityRef.current.set(layerId, (style["text-opacity"] as number) ?? 1);
        } else {
          map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
          // Live update paint properties when style changes (e.g. from CustomLayerManagement)
          if (appliedStylesRef.current.get(layerId) !== styleKey) {
            const layerType = resolveLayerType(style);
            const paintProps = buildPaintProps(layerType, style);
            try {
              for (const [prop, value] of Object.entries(paintProps)) {
                map.setPaintProperty(layerId, prop, value);
              }
              // Live update filter when style changes
              map.setFilter(layerId, (style["filter"] ?? null) as Parameters<typeof map.setFilter>[1]);
            } catch { /* layer may be in transition */ }
            appliedStylesRef.current.set(layerId, styleKey);
            // Update base opacity for slider calculations
            if (layerType === "fill") baseOpacityRef.current.set(layerId, (style["fill-opacity"] as number) ?? 0.5);
            else if (layerType === "line") baseOpacityRef.current.set(layerId, (style["line-opacity"] as number) ?? 1);
            else if (layerType === "circle") baseOpacityRef.current.set(layerId, 1);
            else if (layerType === "symbol") baseOpacityRef.current.set(layerId, (style["text-opacity"] as number) ?? 1);
          }
        }
        continue;
      }

      // Standard MVT layer
      const url = tileUrlForLayer(layer.tile_url, layer.source_table);
      if (!url) continue;

      // Add source if not exists
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "vector",
          tiles: [url],
          minzoom: layer.min_zoom,
          maxzoom: layer.max_zoom,
        });
      }

      if (!map.getLayer(layerId)) {
        const style = (layer.style ?? {}) as Record<string, unknown>;
        const layerType = resolveLayerType(style);
        const paintProps = buildPaintProps(layerType, style);

        const layoutProps = buildLayoutProps(layerType, style, visible);

        const layerDef: Record<string, unknown> = {
          id: layerId,
          type: layerType,
          source: sourceId,
          "source-layer": layer.source_table ?? layer.code,
          paint: paintProps,
          layout: layoutProps,
        };
        if (style["filter"] != null) layerDef["filter"] = style["filter"];

        map.addLayer(layerDef as Parameters<typeof map.addLayer>[0]);

        addedLayersRef.current.add(layerId);
        layerTypesRef.current.set(layerId, layerType);
        // Store base opacity from style for later slider calculations
        const s = layer.style as Record<string, unknown>;
        if (layerType === "fill") baseOpacityRef.current.set(layerId, (s["fill-opacity"] as number) ?? 0.5);
        else if (layerType === "line") baseOpacityRef.current.set(layerId, (s["line-opacity"] as number) ?? 1);
        else if (layerType === "circle") baseOpacityRef.current.set(layerId, 1);
        else if (layerType === "symbol") baseOpacityRef.current.set(layerId, (s["text-opacity"] as number) ?? 1);
      } else {
        map.setLayoutProperty(
          layerId,
          "visibility",
          visible ? "visible" : "none",
        );
      }
    }
  }, [map, layers, visibleIds]);

  // Apply opacity changes
  useEffect(() => {
    if (!map) return;

    for (const layer of layers) {
      const layerId = `lyr-${layer.code}`;
      if (!map.getLayer(layerId)) continue;
      const sliderOpacity = opacityMap.get(layer.id) ?? 1;
      const layerType = layerTypesRef.current.get(layerId);
      const baseOpacity = baseOpacityRef.current.get(layerId) ?? 1;

      try {
        if (layerType === "fill") {
          map.setPaintProperty(layerId, "fill-opacity", sliderOpacity * baseOpacity);
        } else if (layerType === "line") {
          map.setPaintProperty(layerId, "line-opacity", sliderOpacity * baseOpacity);
        } else if (layerType === "circle") {
          map.setPaintProperty(layerId, "circle-opacity", sliderOpacity * baseOpacity);
        } else if (layerType === "symbol") {
          map.setPaintProperty(layerId, "text-opacity", sliderOpacity * baseOpacity);
        }
      } catch {
        // Layer may not exist yet
      }
    }
  }, [map, layers, opacityMap]);

  // Cleanup layers when component unmounts
  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        for (const id of addedLayersRef.current) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
      } catch {
        // Map may already be removed (e.g. navigating to login form)
      }
      addedLayersRef.current.clear();
    };
  }, [map]);

  return null;
}
