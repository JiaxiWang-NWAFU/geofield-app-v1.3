/**
 * App 根组件 v1.3
 * BUG-1修复: 15秒总超时 + 加载进度显示
 * 新增路由: /plant-detail/:quadratId/:plantId
 */

import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import MapPage from '../pages/MapPage';
import QuadratPage from '../pages/QuadratPage';
import InvestigationPage from '../pages/InvestigationPage';
import SettingsPage from '../pages/SettingsPage';
import PlantDetailPage from './PlantDetailPage';
import { initDatabase } from '../services/database';
import { useSurveyStore } from '../stores/surveyStore';
import { useSettingsStore } from '../stores/settingsStore';

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initStep, setInitStep] = useState('正在初始化...');
  const loadSurveys = useSurveyStore((s) => s.loadSurveys);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      // BUG-1修复: 总超时缩短至15秒
      const timeoutId = setTimeout(() => {
        if (mounted) {
          console.warn('[野外调查助手] 初始化超时15s，强制进入');
          setIsReady(true);
        }
      }, 15000);

      try {
        setInitStep('初始化数据库...');
        await initDatabase();
        if (!mounted) return;
        setInitStep('加载调查项目...');
        await loadSurveys();
        if (!mounted) return;
        setInitStep('加载设置...');
        await loadSettings();
        if (!mounted) return;
        clearTimeout(timeoutId);
        setIsReady(true);
      } catch (error) {
        console.error('[野外调查助手] 初始化失败:', error);
        if (mounted) {
          setInitError('应用初始化失败，请重试');
          clearTimeout(timeoutId);
          setIsReady(true);
        }
      }
    }
    initialize();
    return () => { mounted = false; };
  }, []);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-primary-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-primary-700 text-lg font-medium">野外调查助手 v1.3</p>
          <p className="text-gray-500 text-sm mt-1">{initStep}</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/map" replace />} />
          <Route path="map" element={<MapPage />} />
          <Route path="quadrat" element={<QuadratPage />} />
          <Route path="quadrat/:quadratId" element={<QuadratPage />} />
          <Route path="investigation" element={<InvestigationPage />} />
          <Route path="plant-detail/:quadratId/:plantId" element={<PlantDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      {initError && (
        <div className="fixed top-4 right-4 bg-red-50 text-red-700 px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {initError}
          <button onClick={() => setInitError(null)} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}
    </HashRouter>
  );
};

export default App;
