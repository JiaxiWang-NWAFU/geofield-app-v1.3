/**
 * Layout 布局组件
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';
import { useQuadratStore } from '../stores/quadratStore';

const Layout: React.FC = () => {
  const currentSurvey = useQuadratStore((s) => s.currentSurvey);

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* 顶部标题栏 */}
      <header className="flex-shrink-0 bg-primary-700 text-white shadow-lg z-40">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
            </div>
            <h1 className="text-base font-bold tracking-wide">野外调查助手</h1>
          </div>

          <div className="text-xs text-primary-200 truncate max-w-[50%]">
            {currentSurvey ? currentSurvey.name : '水土保持调查'}
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 overflow-auto relative">
        <Outlet />
      </main>

      {/* 底部标签栏 */}
      <TabBar />
    </div>
  );
};

export default Layout;
