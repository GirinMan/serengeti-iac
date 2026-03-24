import { get, post } from "./client";
import type { UserInfo } from "./auth";

interface CreateUserBody {
  username: string;
  password: string;
  name?: string;
  role?: string;
}

interface UpdateUserBody {
  name?: string;
  role?: string;
  is_active?: boolean;
  password?: string;
}

export function fetchUsers(): Promise<UserInfo[]> {
  return get<UserInfo[]>("/v1/users/");
}

export function createUser(body: CreateUserBody): Promise<UserInfo> {
  return post<UserInfo>("/v1/users/", body);
}

export async function updateUser(id: number, body: UpdateUserBody): Promise<UserInfo> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "/api"}/v1/users/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("gis_token") ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function deleteUser(id: number): Promise<void> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "/api"}/v1/users/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("gis_token") ?? ""}`,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
}

export async function setUserRegions(userId: number, regionCodes: string[]): Promise<UserInfo> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "/api"}/v1/users/${userId}/regions`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("gis_token") ?? ""}`,
    },
    body: JSON.stringify({ region_codes: regionCodes }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
