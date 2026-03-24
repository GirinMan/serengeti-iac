import { get, post, patch, del } from "./client";

export interface DataSource {
  id: number;
  name: string;
  source_type: string;
  url: string;
  api_key: string | null;
  parameters: Record<string, unknown>;
  schedule_cron: string | null;
  target_table: string;
  region_code: string;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  last_sync_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface DataSourceCreatePayload {
  name: string;
  source_type: string;
  url: string;
  api_key?: string;
  parameters?: Record<string, unknown>;
  schedule_cron?: string;
  target_table: string;
  region_code: string;
  is_active?: boolean;
}

export interface DataSourceUpdatePayload {
  name?: string;
  url?: string;
  api_key?: string;
  parameters?: Record<string, unknown>;
  schedule_cron?: string;
  target_table?: string;
  is_active?: boolean;
}

export interface SyncTriggerResponse {
  data_source_id: number;
  status: string;
  message: string;
}

export function fetchDataSources() {
  return get<DataSource[]>("/v1/data-sources/");
}

export function createDataSource(payload: DataSourceCreatePayload) {
  return post<DataSource>("/v1/data-sources/", payload);
}

export function updateDataSource(id: number, payload: DataSourceUpdatePayload) {
  return patch<DataSource>(`/v1/data-sources/${id}`, payload);
}

export function deleteDataSource(id: number) {
  return del(`/v1/data-sources/${id}`);
}

export function triggerSync(id: number) {
  return post<SyncTriggerResponse>(`/v1/data-sources/${id}/sync`, {});
}
