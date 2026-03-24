const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("gis_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("gis_token");
    window.dispatchEvent(new Event("auth:logout"));
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export function get<T>(path: string) {
  return request<T>(path);
}

export function post<T>(path: string, body: unknown) {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function patch<T>(path: string, body: unknown) {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (res.status === 401) {
    localStorage.removeItem("gis_token");
    window.dispatchEvent(new Event("auth:logout"));
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
}

export async function uploadFile<T>(
  path: string,
  file: File,
  params: Record<string, string> = {},
  method: "POST" | "PUT" = "POST",
): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const formData = new FormData();
  formData.append("file", file);

  const url = qs ? `${BASE_URL}${path}?${qs}` : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    body: formData,
  });
  if (res.status === 401) {
    localStorage.removeItem("gis_token");
    window.dispatchEvent(new Event("auth:logout"));
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}
