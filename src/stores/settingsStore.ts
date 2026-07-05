/**
 * 设置状态管理 v1.3
 */

import { create } from 'zustand';
import type { AppSettings } from '../types';
import * as db from '../services/database';

interface SettingsState {
  settings: AppSettings | null;
  basemapType: string;
  tiandituToken: string;
  customBasemapUrl: string;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setBasemapType: (type: string) => void;
  setTiandituToken: (token: string) => void;
  setCustomBasemapUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  basemapType: 'tianditu_satellite',
  tiandituToken: '',
  customBasemapUrl: '',
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await db.getSettings();
      set({ settings, isLoading: false });
    } catch { set({ isLoading: false }); }
  },
  updateSettings: async (partial) => {
    try {
      await db.saveSettings(partial);
      set((state) => ({ settings: state.settings ? { ...state.settings, ...partial } : null }));
    } catch (error) { console.error('保存设置失败:', error); }
  },
  setBasemapType: (type) => set({ basemapType: type }),
  setTiandituToken: (token) => set({ tiandituToken: token }),
  setCustomBasemapUrl: (url) => set({ customBasemapUrl: url }),
}));
