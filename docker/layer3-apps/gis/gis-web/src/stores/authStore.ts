import { create } from "zustand";
import type { UserInfo } from "@/api/auth";

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  setToken: (token: string | null) => void;
  setUser: (user: UserInfo | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("gis_token"),
  user: null,
  setToken: (token) => {
    if (token) localStorage.setItem("gis_token", token);
    else localStorage.removeItem("gis_token");
    set({ token });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem("gis_token");
    set({ token: null, user: null });
  },
}));

// Listen for 401 logout events from API client
window.addEventListener("auth:logout", () => {
  useAuthStore.getState().logout();
});
