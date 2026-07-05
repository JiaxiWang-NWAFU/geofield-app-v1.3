/**
 * 设置页 v1.3
 * 自定义调查类型 / 天气配置 / BUG-3修复保留
 */

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useSurveyStore } from '../stores/surveyStore';
import { useQuadratStore } from '../stores/quadratStore';
import { useMapStore } from '../stores/mapStore';
import { exportToWord, exportToExcel } from '../services/export';
import { selectKMLFile, parseKML } from '../services/kml';
import type { KMLParseResult } from '../services/kml';
import * as db from '../services/database';
import { showToast, confirmDialog } from '../utils/helpers';
import { getDatabaseSize } from '../services/plantDatabase';
import type { QuadratSubType } from '../types';

const APP_VERSION = '1.3.0';

const SettingsPage: React.FC = () => {
  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const { surveys, loadSurveys } = useSurveyStore();
  const { currentSurvey, loadQuadrats } = useQuadratStore();
  const { setBasemapType: setMapBasemapType, setTiandituToken, setCustomBasemapUrl } = useMapStore();

  const [username, setUsername] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'word' | 'excel'>('word');
  const [selectedSurveyId, setSelectedSurveyId] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [kmlPreview, setKmlPreview] = useState<KMLParseResult | null>(null);
  const [showKmlPreview, setShowKmlPreview] = useState(false);

  useEffect(() => { loadSurveys(); }, []);

  useEffect(() => {
    if (settings) {
      setUsername(settings.username);
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    await updateSettings({ username });
    setTiandituToken(settings?.basemap_api_url || '');
    showToast('设置已保存');
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const options = { format: exportFormat, survey_id: selectedSurveyId === 'all' ? undefined : selectedSurveyId, include_photos: true, include_stats: true };
      if (exportFormat === 'word') await exportToWord(options); else await exportToExcel(options);
      showToast(`${exportFormat === 'word' ? 'Word' : 'Excel'} 已导出`);
    } catch { showToast('导出失败'); }
    setIsExporting(false);
  };

  const handleImportKML = async () => {
    const file = await selectKMLFile();
    if (!file) return;
    if (file.isKMZ) { showToast('KMZ 暂不支持直接解析，请解压后使用 KML'); return; }
    const result = parseKML(file.content);
    if (result.errors.length > 0) showToast('解析有错误：' + result.errors[0]);
    setKmlPreview(result);
    setShowKmlPreview(true);
  };

  const handleConfirmKMLImport = async () => {
    if (!kmlPreview || !currentSurvey) { showToast('请先选择调查项目'); return; }
    let imported = 0;
    for (const point of kmlPreview.points) {
      try {
        await db.createQuadrat(currentSurvey.id, {
          name: point.name || `KML点位_${imported + 1}`, type: 'vegetation',
          latitude: point.latitude, longitude: point.longitude, elevation: point.altitude,
          survey_date: new Date().toISOString().split('T')[0],
          notes: point.description || '从 KML 导入',
        });
        imported++;
      } catch {}
    }
    await loadQuadrats();
    showToast(`成功导入 ${imported} 个点位`);
    setShowKmlPreview(false);
  };

  const toggleSection = (s: string) => setExpandedSection(expandedSection === s ? null : s);

  return (
    <div className="h-full overflow-auto bg-gray-50 pb-4">
      <div className="p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-4">⚙️ 设置</h2>

        {/* User info */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <button onClick={() => toggleSection('user')} className="w-full flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">👤 用户信息</span>
            <span className="text-gray-400">{expandedSection === 'user' ? '▲' : '▼'}</span>
          </button>
          {expandedSection === 'user' && (
            <div className="mt-3 space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">用户名</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="输入用户名" /></div>
              <button onClick={handleSaveSettings} className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm">保存设置</button>
            </div>
          )}
        </div>

        {/* Basemap info */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <button onClick={() => toggleSection('basemap')} className="w-full flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">🗺️ 底图信息</span>
            <span className="text-gray-400">{expandedSection === 'basemap' ? '▲' : '▼'}</span>
          </button>
          {expandedSection === 'basemap' && (
            <div className="mt-3 text-xs text-gray-500 space-y-1">
              <p>底图 Token 已内置（天地图），无需手动配置。</p>
              <p>支持底图：卫星影像、地形晕渲、矢量地图、OSM</p>
              <p>可在地图页面直接切换底图类型。</p>
            </div>
          )}
        </div>

        {/* AI settings */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <button onClick={() => toggleSection('ai')} className="w-full flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">🤖 AI 识别</span>
            <span className="text-gray-400">{expandedSection === 'ai' ? '▲' : '▼'}</span>
          </button>
          {expandedSection === 'ai' && (
            <div className="mt-3 text-xs text-gray-500 space-y-1">
              <p>百度AI植物识别已集成（API Key 已内置）。</p>
              <p>本地盖度计算基于 Canvas HSV 绿色检测。</p>
              <p>植物数据库：内置 {getDatabaseSize()} 种常见植物。</p>
            </div>
          )}
        </div>

        {/* Export */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <button onClick={() => toggleSection('export')} className="w-full flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">📤 数据导出</span>
            <span className="text-gray-400">{expandedSection === 'export' ? '▲' : '▼'}</span>
          </button>
          {expandedSection === 'export' && (
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
                  <option value="word">Word 文档</option>
                  <option value="excel">Excel 表格</option>
                </select>
                <select value={selectedSurveyId} onChange={(e) => setSelectedSurveyId(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
                  <option value="all">全部项目</option>
                  {surveys.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button onClick={handleExport} disabled={isExporting}
                className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm">{isExporting ? '导出中...' : '导出'}</button>
            </div>
          )}
        </div>

        {/* KML Import */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <button onClick={() => toggleSection('kml')} className="w-full flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">📥 KML 导入</span>
            <span className="text-gray-400">{expandedSection === 'kml' ? '▲' : '▼'}</span>
          </button>
          {expandedSection === 'kml' && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-500">导入 KML 文件中的点位到当前调查项目</p>
              <button onClick={handleImportKML} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm">选择 KML 文件</button>
              {showKmlPreview && kmlPreview && (
                <div className="border rounded-lg p-3">
                  <p className="text-sm">解析到 {kmlPreview.points.length} 个点位</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setShowKmlPreview(false)} className="flex-1 py-1.5 border rounded-lg text-xs">取消</button>
                    <button onClick={handleConfirmKMLImport} className="flex-1 py-1.5 bg-primary-600 text-white rounded-lg text-xs">确认导入</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Plant database info */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <button onClick={() => toggleSection('plantdb')} className="w-full flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">🌿 植物数据库</span>
            <span className="text-gray-400">{expandedSection === 'plantdb' ? '▲' : '▼'}</span>
          </button>
          {expandedSection === 'plantdb' && (
            <div className="mt-3 text-xs text-gray-500">
              <p>内置 {getDatabaseSize()} 种常见中国植物</p>
              <p>支持模糊搜索（中文名、拉丁名、科、属）</p>
              <p>在植物详情页可直接搜索使用</p>
            </div>
          )}
        </div>

        {/* About */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <div className="text-center">
            <p className="text-sm font-bold text-gray-700">野外调查助手</p>
            <p className="text-xs text-gray-400 mt-1">v{APP_VERSION}</p>
            <p className="text-xs text-gray-400 mt-2">水土保持科研调查工具</p>
            <p className="text-xs text-gray-300 mt-1">离线优先 · 天地图 · 百度AI</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
