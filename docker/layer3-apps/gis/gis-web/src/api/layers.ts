import { get, del, patch, uploadFile } from "./client";

export interface Layer {
  id: number;
  region_id: number | null;
  code: string;
  name: string;
  category: string;
  source_table: string | null;
  tile_url: string | null;
  min_zoom: number;
  max_zoom: number;
  visible: boolean;
  sort_order: number;
  style: Record<string, unknown>;
}

export function fetchLayers(regionCode?: string): Promise<Layer[]> {
  const qs = regionCode ? `?region=${regionCode}` : "";
  return get<Layer[]>(`/v1/layers/${qs}`);
}

export function createCustomLayer(
  file: File,
  name: string,
  regionCode: string,
  color: string,
  layerType: string,
): Promise<Layer> {
  return uploadFile<Layer>("/v1/layers/custom", file, {
    name,
    region_code: regionCode,
    color,
    layer_type: layerType,
  });
}

export function updateCustomLayer(
  code: string,
  data: { name?: string; color?: string; opacity?: number; width?: number },
): Promise<Layer> {
  return patch<Layer>(`/v1/layers/custom/${code}`, data);
}

export function replaceCustomLayerGeoJSON(
  code: string,
  file: File,
): Promise<Layer> {
  return uploadFile<Layer>(`/v1/layers/custom/${code}/geojson`, file, {}, "PUT");
}

export function deleteCustomLayer(code: string): Promise<void> {
  return del(`/v1/layers/custom/${code}`);
}
