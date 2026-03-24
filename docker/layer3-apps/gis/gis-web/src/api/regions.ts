import { get, post, patch, del } from "./client";

export interface Region {
  id: number;
  code: string;
  name: string;
  bbox: { type: string; coordinates: number[][][] } | null;
  center: { type: string; coordinates: number[] } | null;
  zoom_min: number;
  zoom_max: number;
}

export interface RegionCreatePayload {
  code: string;
  name: string;
  bbox_wkt: string;
  center_wkt: string;
  zoom_min: number;
  zoom_max: number;
  srid_source?: number;
}

export interface RegionUpdatePayload {
  name?: string;
  bbox_wkt?: string;
  center_wkt?: string;
  zoom_min?: number;
  zoom_max?: number;
}

export function fetchRegions(): Promise<Region[]> {
  return get<Region[]>("/v1/regions/");
}

export function fetchRegion(code: string): Promise<Region> {
  return get<Region>(`/v1/regions/${code}`);
}

export function createRegion(payload: RegionCreatePayload): Promise<Region> {
  return post<Region>("/v1/regions/", payload);
}

export function updateRegion(code: string, payload: RegionUpdatePayload): Promise<Region> {
  return patch<Region>(`/v1/regions/${code}`, payload);
}

export function deleteRegion(code: string): Promise<void> {
  return del(`/v1/regions/${code}`);
}
