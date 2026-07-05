import React from 'react';
import { useLocation } from 'react-router-dom';
import TabBar from './TabBar';
import MapPage from '../pages/MapPage';
import QuadratPage from '../pages/QuadratPage';
import InvestigationPage from '../pages/InvestigationPage';
import SettingsPage from '../pages/SettingsPage';
import PlantDetailPage from './PlantDetailPage';
import { useQuadratStore } from '../stores/quadratStore';

const Layout: React.FC = () => {
  const location = useLocation();
  const currentSurvey = useQuadratStore((s) => s.currentSurvey);
  const path = location.pathname;

  // 地图常驻 DOM，用 CSS 隐藏，防止 WebGL 白屏
  const showMap = path === '/map' || path === '/';
  const showQuadrat = path.startsWith('/quadrat');
  const showInvestigation = path === '/investigation';
  const showSettings = path === '/settings';

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <header className="flex-shrink-0 bg-primary-700 text-white shadow-lg z-40">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 012 2v1a2 2 002 2 2 2 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 012 2 2 2 010 4 0 012-2h1.064M15 20.488V18a2 2 012-2h3.064" />
              </svg>
            </div>
            <h1 className="text-base font-bold tracking-wide">野外调查助手</h1>
          </div>
          <div className="text-xs text-primary-200 truncate max-w-[50%]">
            {currentSurvey ? currentSurvey.name : '水土保持调查'}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 ${!showMap ? 'invisible pointer-events-none' : ''}`}>
          <MapPage />
        </div>
        <div className={`absolute inset-0 overflow-auto ${!showQuadrat ? 'invisible pointer-events-none' : ''}`}>
          <QuadratPage />
        </div>
        <div className={`absolute inset-0 overflow-auto ${!showInvestigation ? 'invisible pointer-events-none' : ''}`}>
          <InvestigationPage />
        </div>
        <div className={`absolute inset-0 overflow-auto ${!showSettings ? 'invisible pointer-events-none' : ''}`}>
          <SettingsPage />
        </div>
        {path.startsWith('/plant-detail/') && <PlantDetailPage />}
      </main>

      <TabBar />
    </div>
  );
};

export default Layout;
