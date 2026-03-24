import { create } from "zustand";
import type { Layer } from "@/api/layers";

interface LayerState {
  layers: Layer[];
  visibleIds: Set<number>;
  opacityMap: Map<number, number>;
  setLayers: (layers: Layer[]) => void;
  toggleLayer: (id: number) => void;
  setVisible: (id: number, visible: boolean) => void;
  setOpacity: (id: number, opacity: number) => void;
  getOpacity: (id: number) => number;
}

export const useLayerStore = create<LayerState>((set, get) => ({
  layers: [],
  visibleIds: new Set(),
  opacityMap: new Map(),
  setLayers: (layers) =>
    set({
      layers,
      visibleIds: new Set(layers.filter((l) => l.visible).map((l) => l.id)),
    }),
  toggleLayer: (id) =>
    set((state) => {
      const next = new Set(state.visibleIds);
      const willHide = next.has(id);
      if (willHide) next.delete(id);
      else next.add(id);
      const layer = state.layers.find((l) => l.id === id);
      if (layer) {
        if (layer.code.endsWith("_LABELS")) {
          // Toggling a child label ON: ensure parent is also ON
          if (!willHide) {
            const parentCode = layer.code.replace(/_LABELS$/, "");
            const parent = state.layers.find((l) => l.code === parentCode);
            if (parent && !next.has(parent.id)) next.add(parent.id);
          }
        } else {
          // Toggling a parent: sync child _LABELS layer
          const child = state.layers.find(
            (l) => l.code === layer.code + "_LABELS",
          );
          if (child) {
            if (willHide) next.delete(child.id);
            else next.add(child.id);
          }
        }
      }
      return { visibleIds: next };
    }),
  setVisible: (id, visible) =>
    set((state) => {
      const next = new Set(state.visibleIds);
      if (visible) next.add(id);
      else next.delete(id);
      return { visibleIds: next };
    }),
  setOpacity: (id, opacity) =>
    set((state) => {
      const next = new Map(state.opacityMap);
      next.set(id, opacity);
      return { opacityMap: next };
    }),
  getOpacity: (id) => get().opacityMap.get(id) ?? 1,
}));
