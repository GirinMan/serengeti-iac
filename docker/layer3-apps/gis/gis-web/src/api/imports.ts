import { get, uploadFile } from "./client";

// del() in client.ts returns void; rollback needs the JSON body, so we use request-style delete
async function deleteWithJson<T>(path: string): Promise<T> {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
  const token = localStorage.getItem("gis_token");
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE", headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface DataImport {
  id: number;
  region_id: number | null;
  filename: string;
  file_type: string;
  target_table: string;
  record_count: number | null;
  status: string;
  error_msg: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface UploadResponse {
  import_id: number;
  minio_path: string;
  status: string;
  message: string;
}

export function uploadImportFile(
  file: File,
  regionCode: string,
  targetTable: string,
  facilityType?: string,
): Promise<UploadResponse> {
  const params: Record<string, string> = {
    region_code: regionCode,
    target_table: targetTable,
  };
  if (facilityType) params.facility_type = facilityType;
  return uploadFile<UploadResponse>("/v1/import/upload", file, params);
}

export function fetchImportHistory(region?: string, limit = 50): Promise<DataImport[]> {
  const qs = new URLSearchParams();
  if (region) qs.set("region", region);
  qs.set("limit", String(limit));
  return get<DataImport[]>(`/v1/import/history?${qs}`);
}

export function fetchImportStatus(importId: number): Promise<DataImport> {
  return get<DataImport>(`/v1/import/status/${importId}`);
}

export interface RollbackResponse {
  import_id: number;
  status: string;
  deleted_count: number;
  target_table: string;
}

export function rollbackImport(importId: number): Promise<RollbackResponse> {
  return deleteWithJson<RollbackResponse>(`/v1/import/rollback/${importId}`);
}
