/**
 * 调查数据状态管理
 */
import { create } from 'zustand';
import type { Survey } from '../types';
import * as db from '../services/database';

interface SurveyState {
  surveys: Survey[];
  isLoading: boolean;
  error: string | null;
  loadSurveys: () => Promise<void>;
  createSurvey: (name: string, description?: string, surveyType?: string) => Promise<Survey | null>;
  updateSurvey: (id: string, name: string, description?: string) => Promise<void>;
  deleteSurvey: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useSurveyStore = create<SurveyState>((set) => ({
  surveys: [],
  isLoading: false,
  error: null,
  loadSurveys: async () => {
    set({ isLoading: true, error: null });
    try { const surveys = await db.getAllSurveys(); set({ surveys, isLoading: false }); }
    catch { set({ error: '加载调查项目失败', isLoading: false }); }
  },
  createSurvey: async (name, description, surveyType) => {
    try {
      const survey = await db.createSurvey(name, description, surveyType);
      set((state) => ({ surveys: [survey, ...state.surveys] }));
      return survey;
    } catch { set({ error: '创建调查项目失败' }); return null; }
  },
  updateSurvey: async (id, name, description) => {
    try {
      await db.updateSurvey(id, name, description);
      set((state) => ({
        surveys: state.surveys.map((s) => s.id === id ? { ...s, name, description, updated_at: new Date().toISOString() } : s),
      }));
    } catch { set({ error: '更新调查项目失败' }); }
  },
  deleteSurvey: async (id) => {
    try {
      await db.deleteSurvey(id);
      set((state) => ({ surveys: state.surveys.filter((s) => s.id !== id) }));
    } catch { set({ error: '删除调查项目失败' }); }
  },
  clearError: () => set({ error: null }),
}));
