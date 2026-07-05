/**
 * 样方状态管理 v1.3
 */

import { create } from 'zustand';
import type { Survey, Quadrat, PlantRecord, QuadratPhoto, Photo } from '../types';
import * as db from '../services/database';

interface QuadratState {
  currentSurvey: Survey | null;
  quadrats: Quadrat[];
  currentQuadrat: Quadrat | null;
  plantRecords: PlantRecord[];
  quadratPhotos: QuadratPhoto[];
  plantPhotos: Record<string, Photo[]>;
  isLoading: boolean;

  setCurrentSurvey: (survey: Survey | null) => Promise<void>;
  loadQuadrats: () => Promise<void>;
  setCurrentQuadrat: (quadrat: Quadrat | null) => Promise<void>;
  loadPlantRecords: () => Promise<void>;
  createPlantRecord: (data: Parameters<typeof db.createPlantRecord>[1]) => Promise<PlantRecord | null>;
  updatePlantRecord: (id: string, data: Parameters<typeof db.updatePlantRecord>[1]) => Promise<void>;
  deletePlantRecord: (id: string) => Promise<void>;
  updatePlantCount: (id: string, count: number) => Promise<void>;
  loadQuadratPhotos: () => Promise<void>;
  loadPlantPhotos: (plantId: string) => Promise<void>;
  getStats: () => {
    speciesCount: number; totalPlants: number; familyCount: number;
    genusCount: number; avgCover: number; minCover: number; maxCover: number;
  };
}

export const useQuadratStore = create<QuadratState>((set, get) => ({
  currentSurvey: null,
  quadrats: [],
  currentQuadrat: null,
  plantRecords: [],
  quadratPhotos: [],
  plantPhotos: {},
  isLoading: false,

  setCurrentSurvey: async (survey) => {
    set({ currentSurvey: survey, currentQuadrat: null, plantRecords: [], quadratPhotos: [], plantPhotos: {} });
    if (survey) { await get().loadQuadrats(); } else { set({ quadrats: [] }); }
  },
  loadQuadrats: async () => {
    const { currentSurvey } = get();
    if (!currentSurvey) return;
    set({ isLoading: true });
    try {
      const quadrats = await db.getQuadratsBySurveyId(currentSurvey.id);
      set({ quadrats, isLoading: false });
    } catch { set({ isLoading: false }); }
  },
  setCurrentQuadrat: async (quadrat) => {
    set({ currentQuadrat: quadrat, plantRecords: [], quadratPhotos: [], plantPhotos: {} });
    if (quadrat) { await get().loadPlantRecords(); await get().loadQuadratPhotos(); }
  },
  loadPlantRecords: async () => {
    const { currentQuadrat } = get();
    if (!currentQuadrat) return;
    try {
      const plantRecords = await db.getPlantRecordsByQuadratId(currentQuadrat.id);
      set({ plantRecords });
    } catch (error) { console.error('加载植物记录失败:', error); }
  },
  createPlantRecord: async (data) => {
    const { currentQuadrat } = get();
    if (!currentQuadrat) return null;
    try {
      const record = await db.createPlantRecord(currentQuadrat.id, data);
      set((state) => ({ plantRecords: [...state.plantRecords, record] }));
      return record;
    } catch { return null; }
  },
  updatePlantRecord: async (id, data) => {
    try {
      await db.updatePlantRecord(id, data);
      set((state) => ({
        plantRecords: state.plantRecords.map(p => p.id === id ? { ...p, ...data } : p),
      }));
    } catch (error) { console.error('更新植物记录失败:', error); }
  },
  deletePlantRecord: async (id) => {
    try {
      await db.deletePlantRecord(id);
      set((state) => ({
        plantRecords: state.plantRecords.filter(p => p.id !== id),
        plantPhotos: Object.fromEntries(Object.entries(state.plantPhotos).filter(([k]) => k !== id)),
      }));
    } catch (error) { console.error('删除植物记录失败:', error); }
  },
  updatePlantCount: async (id, count) => {
    try {
      await db.updatePlantCount(id, count);
      set((state) => ({
        plantRecords: state.plantRecords.map(p => p.id === id ? { ...p, count } : p),
      }));
    } catch (error) { console.error('更新计数失败:', error); }
  },
  loadQuadratPhotos: async () => {
    const { currentQuadrat } = get();
    if (!currentQuadrat) return;
    try {
      const photos = await db.getQuadratPhotos(currentQuadrat.id);
      set({ quadratPhotos: photos });
    } catch (error) { console.error('加载样方照片失败:', error); }
  },
  loadPlantPhotos: async (plantId) => {
    try {
      const photos = await db.getPhotosByPlantRecordId(plantId);
      set((state) => ({ plantPhotos: { ...state.plantPhotos, [plantId]: photos } }));
    } catch (error) { console.error('加载植物照片失败:', error); }
  },
  getStats: () => {
    const { plantRecords } = get();
    const speciesCount = new Set(plantRecords.map(p => p.species_name)).size;
    const totalPlants = plantRecords.reduce((sum, p) => sum + p.count, 0);
    const families = new Set(plantRecords.filter(p => p.family).map(p => p.family!));
    const genera = new Set(plantRecords.filter(p => p.genus).map(p => p.genus!));
    const covers = plantRecords.filter(p => p.cover_percent != null).map(p => p.cover_percent!);
    const avgCover = covers.length > 0 ? covers.reduce((s, c) => s + c, 0) / covers.length : 0;
    const minCover = covers.length > 0 ? Math.min(...covers) : 0;
    const maxCover = covers.length > 0 ? Math.max(...covers) : 0;
    return { speciesCount, totalPlants, familyCount: families.size, genusCount: genera.size, avgCover, minCover, maxCover };
  },
}));
