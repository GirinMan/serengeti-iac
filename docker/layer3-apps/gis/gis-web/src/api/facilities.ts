import { get } from "./client";

export interface Facility {
  id: number;
  region_id: number | null;
  type_id: number | null;
  fac_id: string | null;
  geojson: Record<string, unknown> | null;
  properties: Record<string, unknown>;
  year: number | null;
}

export interface FacilityType {
  id: number;
  code: string;
  name: string;
  category: string;
  geom_type: string;
  symbol_key: string | null;
  style: Record<string, unknown>;
}

export function fetchFacilityTypes(): Promise<FacilityType[]> {
  return get<FacilityType[]>("/v1/facilities/types");
}

export function fetchFacility(id: number): Promise<Facility> {
  return get<Facility>(`/v1/facilities/${id}`);
}

export function fetchFacilities(params: {
  region?: string;
  type?: string;
  bbox?: string;
}): Promise<Facility[]> {
  const qs = new URLSearchParams();
  if (params.region) qs.set("region", params.region);
  if (params.type) qs.set("type", params.type);
  if (params.bbox) qs.set("bbox", params.bbox);
  return get<Facility[]>(`/v1/facilities/?${qs}`);
}
