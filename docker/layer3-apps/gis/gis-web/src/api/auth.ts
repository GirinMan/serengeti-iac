import { get, patch, post } from "./client";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserInfo {
  id: number;
  username: string;
  name: string | null;
  role: string;
  is_active: boolean;
  approval_status: string | null;
  upload_permission: boolean;
  tenant_id: number | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  region_codes: string[];
}

export function login(username: string, password: string): Promise<TokenResponse> {
  return post<TokenResponse>("/v1/auth/login", { username, password });
}

export function refreshToken(): Promise<TokenResponse> {
  return post<TokenResponse>("/v1/auth/refresh", {});
}

export function fetchMe(): Promise<UserInfo> {
  return get<UserInfo>("/v1/auth/me");
}

export function register(username: string, password: string, name?: string): Promise<UserInfo> {
  return post<UserInfo>("/v1/auth/register", { username, password, name: name || undefined });
}

export function updateProfile(data: {
  name?: string;
  current_password?: string;
  new_password?: string;
}): Promise<UserInfo> {
  return patch<UserInfo>("/v1/auth/me", data);
}

export function forgotPassword(username: string): Promise<{ message: string }> {
  return post<{ message: string }>("/v1/auth/forgot-password", { username });
}

export function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return post<{ message: string }>("/v1/auth/reset-password", { token, new_password: newPassword });
}
