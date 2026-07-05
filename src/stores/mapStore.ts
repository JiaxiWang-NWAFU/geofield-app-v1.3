/**
 * 地图状态管理 v1.3
 * 天地图 Token 硬编码
 */

import { create } from 'zustand';
import type { MapPOI, GeoPosition, Quadrat } from '../types';

export type BasemapType = 'tianditu_satellite' | 'tianditu_terrain' | 'tianditu_vector' | 'osm';

// 硬编码天地图 Token
const TIANDITU_TOKEN = '21c2ff26a8647a6816c1eef8e015731e';

// 天地图 URL 构建（使用 t0 服务器 + Web Mercator 投影 _w）
function tdUrl(layer: string, tkLayer: string): string {
  return `http://t0.tianditu.gov.cn/${layer}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${tkLayer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${TIANDITU_TOKEN}`;
}

export interface BasemapConfig {
  type: BasemapType;
  url: string;
  attribution: string;
  overlayUrl?: string;
}

export function getBasemapConfig(type: BasemapType): BasemapConfig {
  switch (type) {
    case 'tianditu_satellite':
      return { type, url: tdUrl('img_w', 'img'), attribution: '天地图', overlayUrl: tdUrl('cia_w', 'cia') };
    case 'tianditu_terrain':
      return { type, url: tdUrl('ter_w', 'ter'), attribution: '天地图', overlayUrl: tdUrl('cta_w', 'cta') };
    case 'tianditu_vector':
      return { type, url: tdUrl('vec_w', 'vec'), attribution: '天地图', overlayUrl: tdUrl('cva_w', 'cva') };
    case 'osm':
      return { type, url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' };
    default:
      return { type: 'tianditu_satellite', url: tdUrl('img_w', 'img'), attribution: '天地图', overlayUrl: tdUrl('cia_w', 'cia') };
  }
}

interface MapState {
  mapLoaded: boolean;
  basemapType: BasemapType;
  tiandituToken: string;
  customBasemapUrl: string;
  mapCenter: [number, number];
  mapZoom: number;
  currentPosition: GeoPosition | null;
  isTracking: boolean;
  watchId: string | null;
  followMode: boolean;
  pois: MapPOI[];
  selectedPOI: MapPOI | null;

  setMapLoaded: (loaded: boolean) => void;
  setBasemapType: (type: BasemapType) => void;
  setTiandituToken: (token: string) => void;
  setCustomBasemapUrl: (url: string) => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setCurrentPosition: (position: GeoPosition | null) => void;
  setTracking: (tracking: boolean, watchId?: string) => void;
  setFollowMode: (follow: boolean) => void;
  setPOIs: (pois: MapPOI[]) => void;
  addPOI: (poi: MapPOI) => void;
  removePOI: (id: string) => void;
  selectPOI: (poi: MapPOI | null) => void;
  updatePOI: (id: string, data: Partial<MapPOI>) => void;
  syncPOIsFromQuadrats: (quadrats: Quadrat[], surveyId: string) => void;
  getBasemapConfig: () => BasemapConfig;
}

const DEFAULT_CENTER: [number, number] = [104.0, 35.0];

export const useMapStore = create<MapState>((set, get) => ({
  mapLoaded: false,
  basemapType: 'tianditu_satellite',
  tiandituToken: TIANDITU_TOKEN,
  customBasemapUrl: '',
  mapCenter: DEFAULT_CENTER,
  mapZoom: 5,
  currentPosition: null,
  isTracking: false,
  watchId: null,
  followMode: false,
  pois: [],
  selectedPOI: null,

  setMapLoaded: (loaded) => set({ mapLoaded: loaded }),
  setBasemapType: (type) => set({ basemapType: type }),
  setTiandituToken: (token) => set({ tiandituToken: token }),
  setCustomBasemapUrl: (url) => set({ customBasemapUrl: url }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  setCurrentPosition: (position) => set({ currentPosition: position }),
  setTracking: (tracking, watchId) => set((state) => ({
    isTracking: tracking,
    watchId: watchId !== undefined ? watchId : state.watchId,
  })),
  setFollowMode: (follow) => set({ followMode: follow }),
  setPOIs: (pois) => set({ pois }),
  addPOI: (poi) => set((state) => ({ pois: [...state.pois, poi] })),
  removePOI: (id) => set((state) => ({
    pois: state.pois.filter((p) => p.id !== id),
    selectedPOI: state.selectedPOI?.id === id ? null : state.selectedPOI,
  })),
  selectPOI: (poi) => set({ selectedPOI: poi }),
  updatePOI: (id, data) => set((state) => ({
    pois: state.pois.map((p) => p.id === id ? { ...p, ...data } : p),
    selectedPOI: state.selectedPOI?.id === id ? { ...state.selectedPOI, ...data } : state.selectedPOI,
  })),
  syncPOIsFromQuadrats: (quadrats, surveyId) => {
    const newPois: MapPOI[] = quadrats
      .filter((q) => q.latitude !== undefined && q.longitude !== undefined)
      .map((q) => ({
        id: q.id,
        name: q.name,
        type: q.type,
        quadrat_sub_type: q.quadrat_sub_type,
        latitude: q.latitude!,
        longitude: q.longitude!,
        survey_id: surveyId,
        quadrat_id: q.id,
      }));
    set({ pois: newPois });
  },
  getBasemapConfig: () => getBasemapConfig(get().basemapType),
}));
