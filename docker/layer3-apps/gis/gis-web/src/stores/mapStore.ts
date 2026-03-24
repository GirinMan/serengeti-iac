import { create } from "zustand";
import type { Region } from "@/api/regions";
import type { Map as MaplibreMap } from "maplibre-gl";

interface HighlightCoord {
  lng: number;
  lat: number;
  label?: string;
}

interface MapState {
  map: MaplibreMap | null;
  region: Region | null;
  highlightCoord: HighlightCoord | null;
  setMap: (map: MaplibreMap | null) => void;
  setRegion: (region: Region) => void;
  setHighlightCoord: (coord: HighlightCoord | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  map: null,
  region: null,
  highlightCoord: null,
  setMap: (map) => set({ map }),
  setRegion: (region) => set({ region }),
  setHighlightCoord: (highlightCoord) => set({ highlightCoord }),
}));
