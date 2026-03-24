import { get } from "./client";

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  address: string | null;
  location: { lat: number; lng: number } | null;
  score: number;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
}

export function searchAddress(
  query: string,
  region?: string,
  size?: number,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (region) params.set("region", region);
  if (size) params.set("size", String(size));
  return get<SearchResponse>(`/v1/search/address?${params}`);
}

export function searchAutocomplete(
  query: string,
  region?: string,
  size: number = 8,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, size: String(size) });
  if (region) params.set("region", region);
  return get<SearchResponse>(`/v1/search/autocomplete?${params}`);
}
